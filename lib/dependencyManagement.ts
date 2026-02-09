import fs from 'fs';
import util from 'util';
import path from 'path';
import { exec as execAsync } from 'node:child_process';
import { getProjectConfig } from './projects/config.js';
import { commands } from '../lang/en.js';
import SpinniesManager from './ui/SpinniesManager.js';
import {
  isGloballyInstalled,
  executeInstall,
  executeUpdate,
  DEFAULT_PACKAGE_MANAGER,
} from './npm/npmCli.js';
import {
  findAllPackageJsonFilesInProjectCached,
  safeGetPackageJsonCached,
} from './npm/packageJson.js';
import { getNpmWorkspaceDirectoryForPackageAtLocationCached } from './npm/workspaces.js';
class NoPackageJsonFilesError extends Error {
  constructor(projectName: string, isUpdate = false) {
    super(
      isUpdate
        ? commands.project.updateDeps.noPackageJsonInProject(projectName)
        : commands.project.installDeps.noPackageJsonInProject(projectName)
    );
  }
}

/**
 * Installs dependencies in multiple package directories, handling npm workspace configuration.
 * Also supports adding new packages as dependencies in specific package directories.
 * Shows progress spinners and manages npm install execution with appropriate flags.
 *
 * @param packages - Optional array of package names to install
 * @param installLocations - Optional array of installation locations (defaults to all package locations in the project)
 * @param dev - Whether to add --save-dev flag (only when packages are specified)
 */
export async function installPackages({
  packages,
  installLocations,
  dev = false,
}: {
  packages?: string[];
  installLocations?: string[];
  dev?: boolean;
}): Promise<void> {
  const installDirs =
    installLocations || (await getProjectPackageJsonLocations());

  const hasPackages = packages && packages.length > 0;

  // Used to collect all of the npm install locations with de-duplication.
  const npmInstallLocationsSet = new Set<string>();

  // Used to collect all of the package install tasks.
  const packageInstallTasks: Array<InstallPackagesInDirectoryOptions> = [];

  for (const dir of installDirs) {
    const npmWorkspaceDirectory =
      await getNpmWorkspaceDirectoryForPackageAtLocationCached(dir);

    if (hasPackages) {
      // Package installation tasks (installing specific packages). No de-duplication needed here.
      packageInstallTasks.push({
        directory: dir,
        packages,
        dev,
        npmWorkspaceDirectory,
      });
    } else {
      if (npmWorkspaceDirectory) {
        // If we are not installing specific packages and we are in an npm workspace then we only need to run
        // `npm install` in the workspace root directory to install the package dependencies for a package that
        // is part of the workspace. Therefore, we add the workspace root for installation instead of the package.
        npmInstallLocationsSet.add(npmWorkspaceDirectory);
      } else {
        npmInstallLocationsSet.add(dir);
      }
    }
  }

  const npmInstallLocations = Array.from(npmInstallLocationsSet).sort();

  // Create tasks for each of the npm install locations to run `npm install` (no specific packages)
  const npmInstallTasks: InstallPackagesInDirectoryOptions[] =
    npmInstallLocations.map(npmInstallLocation => ({
      directory: npmInstallLocation,
      packages: undefined,
      dev: false,
      npmWorkspaceDirectory: null,
    }));

  // Run all tasks in parallel
  await Promise.all(
    [...npmInstallTasks, ...packageInstallTasks].map(task =>
      installPackagesInDirectory(task)
    )
  );
}

interface InstallPackagesInDirectoryOptions {
  /**
   * The package directory to install dependencies in.
   */
  directory: string;
  /**
   * Optional array of package names to add as dependencies. If not specified, all dependencies will be installed.
   */
  packages?: string[];
  /**
   * Whether to add --save-dev flag (only when packages are specified).
   */
  dev?: boolean;
  /**
   * The workspace root directory if this is a workspace package, null otherwise.
   */
  npmWorkspaceDirectory: string | null;
}

/**
 * Installs packages in a specific directory, handling npm workspace configuration.
 * Shows progress spinners and manages npm install execution with appropriate flags.
 *
 * @param directory - The target directory for package installation
 * @param packages - Optional array of package names to install
 * @param dev - Whether to add --save-dev flag (only when packages are specified)
 * @param npmWorkspaceDirectory - The workspace root directory if this is a workspace package, null otherwise
 */
async function installPackagesInDirectory({
  directory,
  packages,
  dev = false,
  npmWorkspaceDirectory,
}: InstallPackagesInDirectoryOptions): Promise<void> {
  const spinner = `installingDependencies-${directory}`;
  const relativeDir = path.relative(process.cwd(), directory) || '.';
  const hasPackages = packages && packages.length > 0;

  SpinniesManager.add(spinner, {
    text:
      packages && packages.length
        ? commands.project.installDeps.addingDependenciesToLocation(
            `[${packages.join(', ')}]`,
            relativeDir
          )
        : commands.project.installDeps.installingDependencies(relativeDir),
  });

  try {
    const flags: string[] = [];
    if (hasPackages && dev) {
      flags.push('--save-dev');
    }
    if (hasPackages && npmWorkspaceDirectory) {
      // If we are installing packages in an npm workspace, we will run `npm install` in the workspace root directory
      // and we will use the --workspace flag to install the packages in the target package directory.
      flags.push(
        `--workspace=${path.relative(npmWorkspaceDirectory, directory)}`
      );
    }

    await executeInstall(packages, flags.length > 0 ? flags.join(' ') : null, {
      // Execute the install in the workspace root directory if this package is part of an npm workspace, otherwise
      // in the package directory.
      cwd: npmWorkspaceDirectory || directory,
    });
    SpinniesManager.succeed(spinner, {
      text: commands.project.installDeps.installationSuccessful(relativeDir),
    });
  } catch (e) {
    SpinniesManager.fail(spinner, {
      text: commands.project.installDeps.installingDependenciesFailed(
        relativeDir
      ),
    });
    throw new Error(
      commands.project.installDeps.installingDependenciesFailed(relativeDir),
      {
        cause: e,
      }
    );
  }
}

export async function updatePackages({
  packages,
  installLocations,
}: {
  packages?: string[];
  installLocations?: string[];
}): Promise<void> {
  const updateDirs =
    installLocations || (await getProjectPackageJsonLocations(undefined, true));

  const hasPackages = packages && packages.length > 0;

  // Used to collect all of the npm update locations with de-duplication.
  const npmUpdateLocationsSet = new Set<string>();

  // Used to collect all of the package update tasks.
  const packageUpdateTasks: Array<UpdatePackagesInDirectoryOptions> = [];

  for (const dir of updateDirs) {
    const npmWorkspaceDirectory =
      await getNpmWorkspaceDirectoryForPackageAtLocationCached(dir);

    if (hasPackages) {
      packageUpdateTasks.push({
        directory: dir,
        packages,
        npmWorkspaceDirectory,
      });
    } else {
      if (npmWorkspaceDirectory) {
        // If we are not updating specific packages and we are in an npm workspace then we only need to run
        // `npm update` in the workspace root directory to update the package dependencies for a package that
        // is part of the workspace. Therefore, we add the workspace root for update instead of the package.
        npmUpdateLocationsSet.add(npmWorkspaceDirectory);
      } else {
        npmUpdateLocationsSet.add(dir);
      }
    }
  }

  const npmUpdateLocations = Array.from(npmUpdateLocationsSet).sort();

  // Create tasks for each of the npm update locations to run `npm update` (no specific packages)
  const npmUpdateTasks: UpdatePackagesInDirectoryOptions[] =
    npmUpdateLocations.map(npmUpdateLocation => ({
      directory: npmUpdateLocation,
      packages: undefined,
      npmWorkspaceDirectory: null,
    }));

  // Run all tasks in parallel
  await Promise.all(
    [...npmUpdateTasks, ...packageUpdateTasks].map(task =>
      updatePackagesInDirectory(task)
    )
  );
}

interface UpdatePackagesInDirectoryOptions {
  /**
   * The package directory to update dependencies in.
   */
  directory: string;
  /**
   * Optional array of package names to add as dependencies. If not specified, all dependencies will be updated.
   */
  packages?: string[];

  /**
   * The workspace root directory if this is a workspace package, null otherwise.
   */
  npmWorkspaceDirectory: string | null;
}

async function updatePackagesInDirectory({
  directory,
  packages,
  npmWorkspaceDirectory,
}: UpdatePackagesInDirectoryOptions): Promise<void> {
  const spinner = `updatingDependencies-${directory}`;
  const relativeDir = path.relative(process.cwd(), directory) || '.';
  const hasPackages = packages && packages.length > 0;

  SpinniesManager.add(spinner, {
    text:
      packages && packages.length
        ? commands.project.updateDeps.updatingDependenciesToLocation(
            `[${packages.join(', ')}]`,
            relativeDir
          )
        : commands.project.updateDeps.updatingDependencies(relativeDir),
  });

  try {
    const flags: string[] = [];

    if (hasPackages && npmWorkspaceDirectory) {
      // If we are updating packages in an npm workspace, we will run `npm update` in the workspace root directory
      // and we will use the --workspace flag to update the packages in the target package directory.
      flags.push(
        `--workspace=${path.relative(npmWorkspaceDirectory, directory)}`
      );
    }

    await executeUpdate(packages, flags.length > 0 ? flags.join(' ') : null, {
      cwd: npmWorkspaceDirectory || directory,
    });
    SpinniesManager.succeed(spinner, {
      text: commands.project.updateDeps.updateSuccessful(relativeDir),
    });
  } catch (e) {
    SpinniesManager.fail(spinner, {
      text: commands.project.updateDeps.updatingDependenciesFailed(relativeDir),
    });
    throw new Error(
      commands.project.updateDeps.updatingDependenciesFailed(relativeDir),
      {
        cause: e,
      }
    );
  }
}

export async function getProjectPackageJsonLocations(
  dir?: string,
  isUpdate = false
): Promise<string[]> {
  const projectConfig = await getProjectConfig(dir);

  if (
    !projectConfig ||
    !projectConfig.projectDir ||
    !projectConfig.projectConfig
  ) {
    throw new Error(
      isUpdate
        ? commands.project.updateDeps.noProjectConfig
        : commands.project.installDeps.noProjectConfig
    );
  }

  const {
    projectDir,
    projectConfig: { srcDir, name },
  } = projectConfig;

  if (!(await isGloballyInstalled(DEFAULT_PACKAGE_MANAGER))) {
    throw new Error(
      isUpdate
        ? commands.project.updateDeps.packageManagerNotInstalled(
            DEFAULT_PACKAGE_MANAGER
          )
        : commands.project.installDeps.packageManagerNotInstalled(
            DEFAULT_PACKAGE_MANAGER
          )
    );
  }

  if (
    !fs.existsSync(projectConfig.projectDir) ||
    !fs.existsSync(path.join(projectDir, srcDir))
  ) {
    throw new NoPackageJsonFilesError(name, isUpdate);
  }

  const packageJsonFiles = await findAllPackageJsonFilesInProjectCached();

  if (packageJsonFiles.length === 0) {
    throw new NoPackageJsonFilesError(name, isUpdate);
  }

  const packageParentDirs: string[] = [];
  packageJsonFiles.forEach(packageJsonFile => {
    const parentDir = path.dirname(packageJsonFile);
    packageParentDirs.push(parentDir);
  });

  return packageParentDirs;
}

function isPackageInPackageJson(
  directory: string,
  packageName: string
): boolean {
  const packageJsonPath = path.join(directory, 'package.json');
  const packageJson = safeGetPackageJsonCached(packageJsonPath);
  if (!packageJson) {
    return false;
  }

  return !!(
    (packageJson.dependencies && packageJson.dependencies[packageName]) ||
    (packageJson.devDependencies && packageJson.devDependencies[packageName])
  );
}

function isPackageInNodeModules(
  directory: string,
  packageName: string
): boolean {
  const packagePath = path.join(directory, 'node_modules', packageName);
  try {
    return fs.existsSync(packagePath);
  } catch (error) {
    return false;
  }
}

export function isPackageInstalled(
  directory: string,
  packageName: string
): boolean {
  const inPackageJson = isPackageInPackageJson(directory, packageName);
  const actuallyInstalled = isPackageInNodeModules(directory, packageName);

  return inPackageJson && actuallyInstalled;
}

export async function hasMissingPackages(directory: string): Promise<boolean> {
  const exec = util.promisify(execAsync);
  const { stdout } = await exec(`npm install --ignore-scripts --dry-run`, {
    cwd: directory,
  });
  return !stdout?.includes('up to date in');
}

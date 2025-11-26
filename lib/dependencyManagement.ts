import fs from 'fs';
import util from 'util';
import path from 'path';
import { exec as execAsync } from 'node:child_process';
import { walk } from '@hubspot/local-dev-lib/fs';
import { getProjectConfig } from './projects/config.js';
import { commands } from '../lang/en.js';
import SpinniesManager from './ui/SpinniesManager.js';
import {
  isGloballyInstalled,
  executeInstall,
  executeUpdate,
  DEFAULT_PACKAGE_MANAGER,
} from './npm.js';
class NoPackageJsonFilesError extends Error {
  constructor(projectName: string, isUpdate = false) {
    super(
      isUpdate
        ? commands.project.updateDeps.noPackageJsonInProject(projectName)
        : commands.project.installDeps.noPackageJsonInProject(projectName)
    );
  }
}

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
  await Promise.all(
    installDirs.map(async dir => {
      await installPackagesInDirectory(dir, packages, dev);
    })
  );
}

async function installPackagesInDirectory(
  directory: string,
  packages?: string[],
  dev = false
): Promise<void> {
  const spinner = `installingDependencies-${directory}`;
  const relativeDir = path.relative(process.cwd(), directory);
  SpinniesManager.init();
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
    const flags = dev && packages && packages.length > 0 ? '--save-dev' : null;
    await executeInstall(packages, flags, { cwd: directory });
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
  const installDirs =
    installLocations || (await getProjectPackageJsonLocations(undefined, true));
  await Promise.all(
    installDirs.map(async dir => {
      await updatePackagesInDirectory(dir, packages);
    })
  );
}

async function updatePackagesInDirectory(
  directory: string,
  packages?: string[]
): Promise<void> {
  const spinner = `updatingDependencies-${directory}`;
  const relativeDir = path.relative(process.cwd(), directory);
  SpinniesManager.init();
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
    await executeUpdate(packages, null, { cwd: directory });
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

  const packageJsonFiles = (await walk(path.join(projectDir, srcDir))).filter(
    file =>
      file.includes('package.json') &&
      !file.includes('node_modules') &&
      !file.includes('.vite')
  );

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

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function isPackageInPackageJson(
  directory: string,
  packageName: string
): boolean {
  const packageJsonPath = path.join(directory, 'package.json');
  try {
    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf-8');
    const packageJson: PackageJson = JSON.parse(packageJsonContent);

    return !!(
      (packageJson.dependencies && packageJson.dependencies[packageName]) ||
      (packageJson.devDependencies && packageJson.devDependencies[packageName])
    );
  } catch (error) {
    return false;
  }
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

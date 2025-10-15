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
  DEFAULT_PACKAGE_MANAGER,
} from './npm.js';
class NoPackageJsonFilesError extends Error {
  constructor(projectName: string) {
    super(commands.project.installDeps.noPackageJsonInProject(projectName));
  }
}

export async function installPackages({
  packages,
  installLocations,
}: {
  packages?: string[];
  installLocations?: string[];
}): Promise<void> {
  const installDirs =
    installLocations || (await getProjectPackageJsonLocations());
  await Promise.all(
    installDirs.map(async dir => {
      await installPackagesInDirectory(dir, packages);
    })
  );
}

async function installPackagesInDirectory(
  directory: string,
  packages?: string[]
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
    await executeInstall(packages, null, { cwd: directory });
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

export async function getProjectPackageJsonLocations(
  dir?: string
): Promise<string[]> {
  const projectConfig = await getProjectConfig(dir);

  if (
    !projectConfig ||
    !projectConfig.projectDir ||
    !projectConfig.projectConfig
  ) {
    throw new Error(commands.project.installDeps.noProjectConfig);
  }

  const {
    projectDir,
    projectConfig: { srcDir, name },
  } = projectConfig;

  if (!(await isGloballyInstalled(DEFAULT_PACKAGE_MANAGER))) {
    throw new Error(
      commands.project.installDeps.packageManagerNotInstalled(
        DEFAULT_PACKAGE_MANAGER
      )
    );
  }

  if (
    !fs.existsSync(projectConfig.projectDir) ||
    !fs.existsSync(path.join(projectDir, srcDir))
  ) {
    throw new NoPackageJsonFilesError(name);
  }

  const packageJsonFiles = (await walk(path.join(projectDir, srcDir))).filter(
    file =>
      file.includes('package.json') &&
      !file.includes('node_modules') &&
      !file.includes('.vite')
  );

  if (packageJsonFiles.length === 0) {
    throw new NoPackageJsonFilesError(name);
  }

  const packageParentDirs: string[] = [];
  packageJsonFiles.forEach(packageJsonFile => {
    const parentDir = path.dirname(packageJsonFile);
    packageParentDirs.push(parentDir);
  });

  return packageParentDirs;
}

export async function hasMissingPackages(directory: string): Promise<boolean> {
  const exec = util.promisify(execAsync);
  const { stdout } = await exec(`npm install --ignore-scripts --dry-run`, {
    cwd: directory,
  });
  return !stdout?.includes('up to date in');
}

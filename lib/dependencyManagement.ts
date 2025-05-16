import fs from 'fs';
import util from 'util';
import path from 'path';
import { exec as execAsync } from 'child_process';
import { walk } from '@hubspot/local-dev-lib/fs';
import { getProjectConfig } from './projects/config';
import { uiLink } from './ui';
import { i18n } from './lang';
import SpinniesManager from './ui/SpinniesManager';
import {
  isGloballyInstalled,
  executeInstall,
  DEFAULT_PACKAGE_MANAGER,
} from './npm';
class NoPackageJsonFilesError extends Error {
  constructor(projectName: string) {
    super(
      i18n(`commands.project.subcommands.installDeps.noPackageJsonInProject`, {
        projectName,
        link: uiLink(
          'Learn how to create a project from scratch.',
          'https://developers.hubspot.com/beta-docs/guides/crm/intro/create-a-project'
        ),
      })
    );
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
        ? i18n(
            `commands.project.subcommands.installDeps.addingDependenciesToLocation`,
            {
              dependencies: `[${packages.join(', ')}]`,
              directory: relativeDir,
            }
          )
        : i18n(
            `commands.project.subcommands.installDeps.installingDependencies`,
            {
              directory: relativeDir,
            }
          ),
  });

  try {
    await executeInstall(packages, null, { cwd: directory });
    SpinniesManager.succeed(spinner, {
      text: i18n(
        `commands.project.subcommands.installDeps.installationSuccessful`,
        {
          directory: relativeDir,
        }
      ),
    });
  } catch (e) {
    SpinniesManager.fail(spinner, {
      text: i18n(
        `commands.project.subcommands.installDeps.installingDependenciesFailed`,
        {
          directory: relativeDir,
        }
      ),
    });
    throw new Error(
      i18n(
        `commands.project.subcommands.installDeps.installingDependenciesFailed`,
        {
          directory: relativeDir,
        }
      ),
      {
        cause: e,
      }
    );
  }
}

export async function getProjectPackageJsonLocations(): Promise<string[]> {
  const projectConfig = await getProjectConfig();

  if (
    !projectConfig ||
    !projectConfig.projectDir ||
    !projectConfig.projectConfig
  ) {
    throw new Error(
      i18n(`commands.project.subcommands.installDeps.noProjectConfig`)
    );
  }

  const {
    projectDir,
    projectConfig: { srcDir, name },
  } = projectConfig;

  if (!(await isGloballyInstalled(DEFAULT_PACKAGE_MANAGER))) {
    throw new Error(
      i18n(
        `commands.project.subcommands.installDeps.packageManagerNotInstalled`,
        {
          packageManager: DEFAULT_PACKAGE_MANAGER,
          link: uiLink(
            DEFAULT_PACKAGE_MANAGER,
            'https://docs.npmjs.com/downloading-and-installing-node-js-and-npm'
          ),
        }
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

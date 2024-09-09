const { logger } = require('@hubspot/local-dev-lib/logger');
const { getProjectConfig } = require('./projects');
const { exec: execAsync } = require('child_process');
const { walk } = require('@hubspot/local-dev-lib/fs');
const path = require('path');
const { uiLink } = require('./ui');
const util = require('util');
const { i18n } = require('./lang');
const SpinniesManager = require('./ui/SpinniesManager');
const fs = require('fs');

const DEFAULT_PACKAGE_MANAGER = 'npm';

const i18nKey = `commands.project.subcommands.installDeps`;

class NoPackageJsonFilesError extends Error {
  constructor(projectName) {
    super(
      i18n(`${i18nKey}.noPackageJsonInProject`, {
        projectName,
        link: uiLink(
          'Learn how to create a project from scratch.',
          'https://developers.hubspot.com/beta-docs/guides/crm/intro/create-a-project'
        ),
      })
    );
  }
}

async function isGloballyInstalled(command) {
  const exec = util.promisify(execAsync);
  try {
    await exec(`${command} --version`);
    return true;
  } catch (e) {
    return false;
  }
}

async function installPackages({ packages, installLocations }) {
  const installDirs =
    installLocations || (await getProjectPackageJsonLocations());
  await Promise.all(
    installDirs.map(async dir => {
      await installPackagesInDirectory(packages, dir);
    })
  );
}

async function installPackagesInDirectory(packages, directory) {
  const spinner = `installingDependencies-${directory}`;
  const relativeDir = path.relative(process.cwd(), directory);
  SpinniesManager.init();
  SpinniesManager.add(spinner, {
    text:
      packages && packages.length
        ? i18n(`${i18nKey}.addingDependenciesToLocation`, {
            dependencies: `[${packages.join(', ')}]`,
            directory: relativeDir,
          })
        : i18n(`${i18nKey}.installingDependencies`, {
            directory: relativeDir,
          }),
  });
  let installCommand = `${DEFAULT_PACKAGE_MANAGER} --prefix=${directory} install`;

  if (packages) {
    installCommand = `${installCommand} ${packages.join(' ')}`;
  }

  logger.debug(`Running ${installCommand}`);
  try {
    const exec = util.promisify(execAsync);
    await exec(installCommand);
    SpinniesManager.succeed(spinner, {
      text: i18n(`${i18nKey}.installationSuccessful`, {
        directory: relativeDir,
      }),
    });
  } catch (e) {
    SpinniesManager.fail(spinner, {
      text: i18n(`${i18nKey}.installingDependenciesFailed`, {
        directory: relativeDir,
      }),
    });
    throw new Error(
      i18n(`${i18nKey}.installingDependenciesFailed`, {
        directory: relativeDir,
      }),
      {
        cause: e,
      }
    );
  }
}

async function getProjectPackageJsonLocations() {
  const projectConfig = await getProjectConfig();

  if (
    !projectConfig ||
    !projectConfig.projectDir ||
    !projectConfig.projectConfig
  ) {
    throw new Error(i18n(`${i18nKey}.noProjectConfig`));
  }

  const {
    projectDir,
    projectConfig: { srcDir, name },
  } = projectConfig;

  if (!(await isGloballyInstalled(DEFAULT_PACKAGE_MANAGER))) {
    throw new Error(
      i18n(`${i18nKey}.packageManagerNotInstalled`, {
        packageManager: DEFAULT_PACKAGE_MANAGER,
        link: uiLink(
          DEFAULT_PACKAGE_MANAGER,
          'https://docs.npmjs.com/downloading-and-installing-node-js-and-npm'
        ),
      })
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

  const packageParentDirs = [];
  packageJsonFiles.forEach(packageJsonFile => {
    const parentDir = path.dirname(packageJsonFile);
    packageParentDirs.push(parentDir);
  });

  return packageParentDirs;
}

module.exports = {
  isGloballyInstalled,
  installPackages,
  DEFAULT_PACKAGE_MANAGER,
  getProjectPackageJsonLocations,
};

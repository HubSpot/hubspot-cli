const { logger } = require('@hubspot/local-dev-lib/logger');
const { getProjectConfig } = require('./projects');
const { exec: execAsync } = require('child_process');
const { walk } = require('@hubspot/local-dev-lib/fs');
const path = require('path');
const { uiLink } = require('./ui');
const util = require('util');
const { i18n } = require('./lang');

const exec = util.promisify(execAsync);
const DEFAULT_PACKAGE_MANAGER = 'npm';

const i18nKey = `commands.project.subcommands.install-deps`;

async function isGloballyInstalled(command) {
  try {
    await exec(`${command} --version`);
    return true;
  } catch (e) {
    return false;
  }
}

async function installPackages({ packages, installLocations, silent = false }) {
  const installDirs = installLocations || (await getProjectPackageJsonFiles());
  await Promise.all(
    installDirs.map(async dir => {
      await installPackagesInDirectory(packages, dir, silent);
    })
  );
}

async function installPackagesInDirectory(packages, directory, silent) {
  if (!silent) {
    logger.info(
      packages && packages.length
        ? i18n(`${i18nKey}.addingDependenciesToLocation`, {
            dependencies: `[${packages.join(', ')}]`,
            location: directory,
          })
        : i18n(`${i18nKey}.installingDependencies`, {
            location: directory,
          })
    );
  }
  let installCommand = `${DEFAULT_PACKAGE_MANAGER} --prefix=${directory} install`;

  if (packages) {
    installCommand = `${installCommand} ${packages.join(' ')}`;
  }

  logger.debug(`Running ${installCommand}`);
  try {
    await exec(installCommand);
  } catch (e) {
    throw new Error(
      i18n(`${i18nKey}.installingDependenciesFailed`, { directory }),
      {
        cause: e,
      }
    );
  }
}

async function getProjectPackageJsonFiles() {
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
    projectConfig: { srcDir },
  } = projectConfig;

  if (!(await isGloballyInstalled(DEFAULT_PACKAGE_MANAGER))) {
    throw new Error(
      i18n(`${i18nKey}.npmNotInstalled`, {
        packageManager: DEFAULT_PACKAGE_MANAGER,
        link: uiLink(
          DEFAULT_PACKAGE_MANAGER,
          'https://docs.npmjs.com/downloading-and-installing-node-js-and-npm'
        ),
      })
    );
  }

  const packageJsonFiles = (await walk(path.join(projectDir, srcDir))).filter(
    file =>
      file.includes('package.json') &&
      !file.includes('node_modules') &&
      !file.includes('.vite') &&
      !file.includes('dist')
  );

  if (packageJsonFiles.length === 0) {
    throw new Error(i18n(`${i18nKey}.noPackageJsonInProject`));
  }

  const packageParentDirs = [];
  packageJsonFiles.forEach(packageJsonFile => {
    const parentDir = path.dirname(packageJsonFile);
    packageParentDirs.push(parentDir);
  });

  return packageParentDirs;
}

module.exports = {
  installPackages,
  installPackagesInDirectory,
  DEFAULT_PACKAGE_MANAGER,
  getProjectPackageJsonFiles,
};

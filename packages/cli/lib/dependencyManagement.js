const { logger } = require('@hubspot/local-dev-lib/logger');
const { getProjectConfig } = require('./projects');
const DEFAULT_PACKAGE_MANAGER = 'npm';
const { execSync } = require('child_process');
const { EXIT_CODES } = require('./enums/exitCodes');
const { walk } = require('@hubspot/local-dev-lib/fs');
const path = require('node:path');
const { uiLink } = require('./ui');

function isGloballyInstalled(command) {
  try {
    execSync(`${command} --version`);
    return true;
  } catch (e) {
    return false;
  }
}

async function installDeps({ packages, installLocations, silent = false }) {
  const installDirs = installLocations || (await getProjectPackageJsonFiles());
  installDirs.forEach(directory => {
    installInDirectory(packages, directory, silent);
  });
}

function installInDirectory(packages, directory, silent) {
  logger.info(
    `Installing dependencies ${
      packages ? `[${packages.join(', ')}] ` : ''
    }in ${directory}`
  );
  let installCommand = `${DEFAULT_PACKAGE_MANAGER} --prefix=${directory} install`;

  if (packages) {
    installCommand = `${installCommand} ${packages.join(' ')}`;
  }

  logger.debug(`Running ${installCommand}`);
  try {
    execSync(installCommand, {
      stdio: silent ? 'ignore' : 'inherit',
    });
  } catch (e) {
    logger.error(`Installing dependencies for ${directory} failed`);
    process.exit(EXIT_CODES.ERROR);
  }
}

async function getProjectPackageJsonFiles() {
  const projectConfig = await getProjectConfig();

  if (
    !projectConfig ||
    !projectConfig.projectDir ||
    !projectConfig.projectConfig
  ) {
    throw new Error('Must be ran within a project');
  }

  const {
    projectDir,
    projectConfig: { srcDir },
  } = projectConfig;

  if (!isGloballyInstalled(DEFAULT_PACKAGE_MANAGER)) {
    throw new Error(
      `This command depends on ${DEFAULT_PACKAGE_MANAGER}, install ${uiLink(
        DEFAULT_PACKAGE_MANAGER,
        'https://docs.npmjs.com/downloading-and-installing-node-js-and-npm'
      )}`
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
    throw new Error('Could not find any package.json files in the project');
  }

  const packageParentDirs = [];
  packageJsonFiles.forEach(packageJsonFile => {
    const parentDir = path.dirname(packageJsonFile);
    packageParentDirs.push(parentDir);
  });

  return packageParentDirs;
}

module.exports = {
  installDeps,
  DEFAULT_PACKAGE_MANAGER,
  getProjectPackageJsonFiles,
};

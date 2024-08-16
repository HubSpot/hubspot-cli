const { logger } = require('@hubspot/local-dev-lib/logger');
const { getProjectConfig } = require('../../lib/projects');
const path = require('node:path');
const { walk } = require('@hubspot/local-dev-lib/fs');
const { execSync } = require('child_process');
const { promptUser } = require('../../lib/prompts/promptUtils');
const chalk = require('chalk');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

function isGloballyInstalled(command) {
  try {
    execSync(`${command} --version`);
    return true;
  } catch (e) {
    return false;
  }
}

const YARN = 'yarn';
const NPM = 'npm';
const PNPM = 'pnpm';

const packageManagers = {
  [NPM]: 'package-lock.json',
  [PNPM]: 'pnpm-lock.yaml',
  [YARN]: 'yarn.lock',
};

const supportedPackageManagers = Object.keys(packageManagers);

function install({
  packageManager,
  packageManagerFlags,
  installDirs,
  packages,
}) {
  installDirs.forEach(directory => {
    logger.info(
      `Installing dependencies ${
        packages ? `[${packages.join(', ')}] ` : ''
      }in ${directory}`
    );
    let installCommand = `${packageManager} --prefix=${directory} install`;
    if (packageManager === YARN) {
      installCommand = `${packageManager} --cwd=${directory} ${
        packages ? 'add' : 'install'
      }`;
    }

    if (packages) {
      installCommand = `${installCommand} ${packages.join(' ')}`;
    }

    if (packageManagerFlags) {
      installCommand = `${installCommand} ${packageManagerFlags}`;
    }

    logger.debug(`Running ${installCommand}`);
    try {
      execSync(installCommand, {
        stdio: 'inherit',
      });
    } catch (e) {
      logger.error(`Installing dependencies for ${directory} failed`);
    }
  });
}

exports.command = 'install [packages..]';
exports.describe = 'Install your deps';
exports.builder = yargs =>
  yargs
    .option('package-manager', {
      alias: 'pm',
      describe: 'The package manager to use for the installation',
      choices: supportedPackageManagers,
    })
    .option('package-manager-flags', {
      alias: 'pm-flags',
      describe: 'Command flags to pass down to the underlying package manager',
      type: 'string',
    });

exports.handler = async ({ packages, pm, packageManagerFlags }) => {
  const availablePackageManagers = new Set();
  const projectConfig = await getProjectConfig();

  if (!projectConfig.projectDir || !projectConfig.projectConfig) {
    logger.error('Must be ran within a project');
    process.exit(EXIT_CODES.ERROR);
  }

  const {
    projectDir,
    projectConfig: { srcDir },
  } = projectConfig;

  const packageJsonFiles = (await walk(path.join(projectDir, srcDir))).filter(
    file =>
      file.includes('package.json') &&
      !file.includes('node_modules') &&
      !file.includes('.vite') &&
      !file.includes('dist')
  );

  if (packageJsonFiles.length === 0) {
    logger.error('Could not find any package.json files in the project');
  }

  const packageParentDirs = [];
  packageJsonFiles.forEach(packageJsonFile => {
    const parentDir = path.dirname(packageJsonFile);
    packageParentDirs.push(parentDir);
    Object.entries(packageManagers).forEach(([packageManager]) => {
      if (
        !availablePackageManagers.has(packageManager) &&
        isGloballyInstalled(packageManager)
      ) {
        availablePackageManagers.add(packageManager);
      }
    });
  });

  if (availablePackageManagers.size === 0) {
    logger.error(
      `Could not find of the supported package managers installed, please install one of the following: ${chalk.cyan(
        supportedPackageManagers.join(', ')
      )}`
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const { packageManager = pm, installLocations } = await promptUser([
    {
      name: 'packageManager',
      type: 'list',
      when: () => !pm,
      message: `We detected the following package managers? Which package manager would you like to use? \n${chalk.yellow(
        'We strongly recommend using `npm` because it is what is used at build time.\nYou may encounter differing behavior between your local and deployed code if you opt for a different package manager'
      )}`,
      choices: supportedPackageManagers,
    },
    {
      name: 'installLocations',
      type: 'checkbox',
      when: () => packages && packages.length > 0,
      message: `Which location would you like to add the dependencies to?`,
      choices: packageParentDirs.map(dir => ({
        name: path.relative(projectDir, dir),
        value: dir,
      })),
      validate: choices => {
        if (choices === undefined || choices.length === 0) {
          return 'You must choose at least one location';
        }
        return true;
      },
    },
  ]);

  if (installLocations) {
    install({
      packageManager,
      packageManagerFlags,
      installDirs: installLocations,
      packages,
    });
  } else {
    install({
      packageManager,
      packageManagerFlags,
      installDirs: packageParentDirs,
    });
  }
};

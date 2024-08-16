const { logger } = require('@hubspot/local-dev-lib/logger');
const { getProjectConfig } = require('../../lib/projects');
const path = require('node:path');
const { walk } = require('@hubspot/local-dev-lib/fs');
const { execSync } = require('child_process');
const { promptUser } = require('../../lib/prompts/promptUtils');
const chalk = require('chalk');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
exports.command = 'install';
exports.describe = 'Install your deps';

// async function lockFileExists(directory, lockfile) {
//   return await fs.pathExists(path.resolve(directory, lockfile));
// }

function isGloballyInstalled(command) {
  try {
    execSync(`${command} --version`);
    return true;
  } catch (e) {
    return false;
  }
}

const packageManagers = {
  npm: 'package-lock.json',
  pnpm: 'pnpm-lock.yaml',
  yarn: 'yarn.lock',
  // bun: 'bun.lockb',
};

exports.handler = async () => {
  const packageManagersInstalled = new Set();
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
      !file.includes('.vite')
  );

  if (packageJsonFiles.length === 0) {
    logger.error('Could not find any package.json files in the project');
  }

  const packageParentDirs = [];
  for (const packageJsonFile of packageJsonFiles) {
    const parentDir = path.dirname(packageJsonFile);
    packageParentDirs.push(parentDir);
    for (const entry of Object.entries(packageManagers)) {
      // const [packageManager, lockfile] = entry;
      const [packageManager] = entry;
      if (
        !packageManagersInstalled.has(packageManager) &&
        //(await lockFileExists(parentDir, lockfile)) || // I'm not certain I want to go this route.  They could have a lockfile, but not the package manager installed
        isGloballyInstalled(packageManager)
      ) {
        packageManagersInstalled.add(packageManager);
      }
    }
  }

  if (packageManagersInstalled.size === 0) {
    logger.error(
      `Could not find of the supported package managers installed, please install on of the following: ${Object.keys(
        packageManagers
      ).join(', ')}`
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const { packageManager } = await promptUser([
    {
      name: 'packageManager',
      type: 'list',
      message: `We detected the following package managers? Which package manager would you like to use? \n${chalk.yellow(
        'We strongly recommend using `npm` because it is what is used at build time.\nYou may encounter differing behavior between your local and deployed code if you opt for a different package manager'
      )}`,
      choices: Array.from(packageManagersInstalled).map(packageManager => ({
        key: packageManager,
        value: packageManager,
      })),
    },
  ]);

  packageParentDirs.forEach(directory => {
    logger.info(`Installing dependencies for ${directory}`);
    let installCommand = `${packageManager} --prefix=${directory} install`;
    if (packageManager === 'yarn') {
      installCommand = `${packageManager} --cwd=${directory} install`;
    }
    execSync(installCommand, {
      stdio: 'inherit',
    });
  });
};

exports.builder = yargs => {
  return yargs;
};

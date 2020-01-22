const fs = require('fs-extra');
// const path = require('path');
// const hostedGitInfo = require('hosted-git-info');
// const validateNpmPackageName = require('validate-npm-package-name');
const execa = require('execa');

const { logger } = require('./logger');
// const { getCwd } = require('./path');
const { canUseYarn } = require('./lib/env');

const DEFAULT_THEME_REPO = 'HubSpot/cms-theme-boilerplate';

// function validateThemePackageName(name) {
//   const validationResult = validateNpmPackageName(name);
//   if (validationResult.validForNewPackages) return true;
//   const [errors, warnings] = validationResult;
//   const groupName =
//     `Could not create a theme called "${name}" because of npm naming restrictions`
//   logger.group(groupName);
//   if (errors) errors.forEach(err => logger.error(err));
//   if (warnings) warnings.forEach(err => logger.warn(err));
//   logger.groupEnd(groupName);
//   return false;
// }

/**
 *
 * @param {String} dest
 * @param {Object} options
 */
async function cloneBoilerplate(dest, { ssh }) {
  const url = ssh
    ? `git@github.com:${DEFAULT_THEME_REPO}.git`
    : `https://github.com/${DEFAULT_THEME_REPO}.git`;
  logger.log('Cloning repo with %s...', ssh ? 'SSH' : 'HTTPS');
  try {
    await execa('git', ['clone', url, dest, '--single-branch'], {
      stdio: 'pipe',
    });
    logger.log('Clone completed');
  } catch (error) {
    logger.error('Clone failed');
    logger.error(error);
  }
}

/**
 *
 * @param {string} dest
 * @param {object} options
 * @returns {Promise}
 */
async function installDeps(dest, { skipInstall }) {
  if (skipInstall) {
    logger.log('Skipping install deps');
    return;
  }
  const currentDir = process.cwd();
  process.chdir(dest);
  logger.log('Installing deps...');
  try {
    const useYarn = canUseYarn();
    logger.log('...installing with `%s`...', useYarn ? 'yarn' : 'npm');
    (await useYarn) ? execa('yarn', ['install']) : execa('npm', ['install']);
    logger.log('Deps installed');
  } catch (error) {
    logger.error('Deps install failed');
    logger.error(error);
  }
  process.chdir(currentDir);
}

/**
 *
 * @param {string} src
 * @param {string} dest
 * @param {object} options
 */
async function createTheme(src, dest, options = {}) {
  // const { clone, ssh } = options;
  await fs.ensureDir(dest);
  // clone repo
  // download zip
  // copy local dir
  // unzip local zip
  await cloneBoilerplate(dest, options);
  await installDeps(dest, options);
}

module.exports = {
  createTheme,
};

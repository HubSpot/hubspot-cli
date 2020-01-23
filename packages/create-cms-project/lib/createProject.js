const fs = require('fs-extra');
const path = require('path');
// const hostedGitInfo = require('hosted-git-info');
const execa = require('execa');
const checkProjectName = require('./checkProjectName');
const { canUseYarn } = require('./config');

/**
 *
 * @param {String}      dest
 * @param {AppOptions}  options
 * @returns {Promise}
 */
function cloneBoilerplate(dest, { ssh, repo }) {
  // const info = hostedGitInfo.fromUrl(repo);

  // TODO: This POC code
  const url = ssh
    ? `git@github.com:${repo}.git`
    : `https://github.com/${repo}.git`;
  console.log('Cloning repo with %s...', ssh ? 'SSH' : 'HTTPS');
  const cmd = execa('git', ['clone', url, dest, '--single-branch'], {
    stdio: 'pipe',
  });
  return cmd
    .then(() => console.log('Clone completed'))
    .catch(error => {
      console.log('Clone failed');
      console.error(error);
    });
}

/**
 *
 * @param {String}      dest
 * @param {AppOptions}  options
 * @returns {Promise}
 */
function installDeps(dest, { skipInstall }) {
  if (skipInstall) {
    console.log('Skipping install deps');
    return Promise.resolve();
  }
  const currentDir = process.cwd();
  process.chdir(dest);
  console.log('Installing deps...');
  const cmd = canUseYarn
    ? execa('yarn', ['install'])
    : execa('npm', ['install']);
  console.log('...installing with `%s`...', canUseYarn ? 'yarn' : 'npm');
  return cmd
    .then(() => {
      process.chdir(currentDir);
      console.log('Deps installed');
    })
    .catch(error => {
      process.chdir(currentDir);
      console.log('Deps install failed');
      console.error(error);
    });
}

/**
 *
 * @param {String}      projectName
 * @param {AppOptions}  options
 */
async function createProject(projectName, options) {
  const dest = path.resolve(projectName);
  const name = path.basename(dest);
  checkProjectName(name);
  fs.ensureDirSync(dest);
  await cloneBoilerplate(dest, options);
  await installDeps(dest, options);
  console.log(`Success: your new project has been created in ${dest}.`);
}

exports = module.exports = createProject;
exports.cloneBoilerplate = cloneBoilerplate;

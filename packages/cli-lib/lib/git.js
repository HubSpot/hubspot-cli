const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const ignore = require('ignore');
const findup = require('findup-sync');
const { logger } = require('../logger');

const makeComparisonDir = filepath => {
  if (typeof filepath !== 'string') return null;
  // Append sep to make comparisons easier e.g. 'foos'.startsWith('foo')
  return path.dirname(path.resolve(filepath)).toLowerCase() + path.sep;
};

const getGitComparisonDir = () => makeComparisonDir(findup('.git'));

// Get all .gitignore files since they can cascade down directory structures
const getGitignoreFiles = configPath => {
  const gitDir = getGitComparisonDir();
  const files = [];
  if (!gitDir) {
    // Not in git
    return files;
  }
  // Start findup from config dir
  let cwd = configPath && path.dirname(configPath);
  while (cwd) {
    const ignorePath = findup('.gitignore', { cwd });
    if (
      ignorePath &&
      // Stop findup after .git dir is reached
      makeComparisonDir(ignorePath).startsWith(makeComparisonDir(gitDir))
    ) {
      const file = path.resolve(ignorePath);
      files.push(file);
      cwd = path.resolve(path.dirname(file) + '..');
    } else {
      cwd = null;
    }
  }
  return files;
};

const isConfigPathInGitRepo = configPath => {
  const gitDir = getGitComparisonDir();
  if (!gitDir) return false;
  const configDir = makeComparisonDir(configPath);
  if (!configDir) return false;
  return configDir.startsWith(gitDir);
};

const configFilenameIsIgnoredByGitignore = (ignoreFiles, configPath) => {
  return ignoreFiles.some(gitignore => {
    const gitignoreContents = fs.readFileSync(gitignore).toString();
    const gitignoreConfig = ignore().add(gitignoreContents);

    if (
      gitignoreConfig.ignores(
        path.relative(path.dirname(gitignore), configPath)
      )
    ) {
      return true;
    }
    return false;
  });
};

const shouldWarnOfGitInclusion = configPath => {
  if (!isConfigPathInGitRepo(configPath)) {
    // Not in git
    return false;
  }
  const gitignoreFiles = getGitignoreFiles(configPath);
  if (configFilenameIsIgnoredByGitignore(gitignoreFiles, configPath)) {
    // Found ignore statement in .gitignore that matches config filename
    return false;
  }
  // In git w/o a gitignore rule
  return true;
};

const checkAndWarnGitInclusion = configPath => {
  try {
    if (!shouldWarnOfGitInclusion(configPath)) return;
    logger.warn('Security Issue');
    logger.warn('Config file can be tracked by git.');
    logger.warn(`File: "${configPath}"`);
    logger.warn(`To remediate:
      - Move config file to your home directory: "${os.homedir()}"
      - Add gitignore pattern "${path.basename(
        configPath
      )}" to a .gitignore file in root of your repository.
      - Ensure that config file has not already been pushed to a remote repository.
    `);
  } catch (e) {
    // fail silently
    logger.debug(
      'Unable to determine if config file is properly ignored by git.'
    );
  }
};

module.exports = {
  checkAndWarnGitInclusion,
  configFilenameIsIgnoredByGitignore,
  isConfigPathInGitRepo,
};

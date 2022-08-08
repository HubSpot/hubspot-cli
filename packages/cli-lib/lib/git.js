const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const ignore = require('ignore');
const findup = require('findup-sync');
const { logger } = require('../logger');
const { DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME } = require('./constants');

const GITIGNORE_FILE = '.gitignore';

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
    const ignorePath = findup(GITIGNORE_FILE, { cwd });
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

const checkGitInclusion = configPath => {
  const result = { inGit: false, configIgnored: false, gitignoreFiles: null };

  if (isConfigPathInGitRepo(configPath)) {
    result.inGit = true;
    result.gitignoreFiles = getGitignoreFiles(configPath);

    if (configFilenameIsIgnoredByGitignore(result.gitignoreFiles, configPath)) {
      // Found ignore statement in .gitignore that matches config filename
      result.configIgnored = true;
    }
  }
  return result;
};

const checkAndWarnGitInclusion = configPath => {
  try {
    const { inGit, configIgnored } = checkGitInclusion(configPath);

    if (!inGit || configIgnored) return;
    logger.warn('Security Issue Detected');
    logger.warn('The HubSpot config file can be tracked by git.');
    logger.warn(`File: "${configPath}"`);
    logger.warn(`To remediate:
      - Move the config file to your home directory: "${os.homedir()}"
      - Add gitignore pattern "${path.basename(
        configPath
      )}" to a .gitignore file in root of your repository.
      - Ensure that the config file has not already been pushed to a remote repository.
    `);
  } catch (e) {
    // fail silently
    logger.debug(
      'Unable to determine if config file is properly ignored by git.'
    );
  }
};

const checkAndUpdateGitignore = configPath => {
  try {
    const { configIgnored, gitignoreFiles } = checkGitInclusion(configPath);
    if (configIgnored) return;

    let gitignoreFilePath =
      gitignoreFiles && gitignoreFiles.length ? gitignoreFiles[0] : null;

    if (!gitignoreFilePath) {
      gitignoreFilePath = path.resolve(configPath, GITIGNORE_FILE);
      fs.writeFileSync(gitignoreFilePath);
    }

    const gitignoreContents = fs.readFileSync(gitignoreFilePath).toString();
    const updatedContents = `${gitignoreContents.trim()}\n\n# HubSpot config file\n${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME}\n`;
    fs.writeFileSync(gitignoreFilePath, updatedContents);
  } catch (e) {
    // fail silently
    logger.debug(
      'Unable to determine if config file is properly ignored by git.'
    );
  }
};

module.exports = {
  checkAndUpdateGitignore,
  checkAndWarnGitInclusion,
  configFilenameIsIgnoredByGitignore,
  isConfigPathInGitRepo,
};

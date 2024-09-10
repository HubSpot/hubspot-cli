const pkg = require('../package.json');
const util = require('util');
const { getProjectConfig } = require('../lib/projects');
const { getAccountId } = require('../lib/commonOpts');
const { getAccessToken } = require('@hubspot/local-dev-lib/personalAccessKey');
const { trackCommandUsage } = require('../lib/usageTracking');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');
const execSync = require('child_process').execSync;
const { walk } = require('@hubspot/local-dev-lib/fs');
const path = require('path');
const { logger } = require('@hubspot/local-dev-lib/logger');

// const i18nKey = 'commands.doctor';
exports.command = 'doctor';
exports.describe = 'The doctor is in';

function getNpmVersion() {
  try {
    return execSync('npm --version')
      .toString()
      .trim();
  } catch (e) {
    return null;
  }
}

function shouldIncludeFile(file) {
  try {
    const ignoredDirs = ['node_modules'];
    for (const ignoredDir of ignoredDirs) {
      if (path.dirname(file).includes(path.join(path.sep, ignoredDir))) {
        return false;
      }
    }
  } catch (e) {
    logger.debug(e);
  }
  return true;
}

exports.handler = async () => {
  const accountId = getAccountId();
  const projectConfig = await getProjectConfig();
  const { env, authType, personalAccessKey, accountType } = getAccountConfig(
    accountId
  );

  try {
    trackCommandUsage('doctor', null, accountId);
  } catch (e) {
    logger.debug(e);
  }

  let accessToken = {};
  try {
    accessToken = await getAccessToken(personalAccessKey, env, accountId);
  } catch (e) {
    logger.debug(e);
  }

  const files = (await walk(projectConfig.projectDir))
    .filter(shouldIncludeFile)
    .map(filename => path.relative(projectConfig.projectDir, filename));

  const {
    platform,
    arch,
    versions: { node },
    mainModule: { path: modulePath },
  } = process;

  const output = {
    platform,
    arch,
    path: modulePath,
    versions: {
      '@hubspot/cli': pkg.version,
      node,
      npm: getNpmVersion(),
    },
    projectConfig,
    account: {
      accountId,
      accountType,
      authType,
      name: accessToken && accessToken.hubName,
      scopeGroups: accessToken && accessToken.scopeGroups,
      enabledFeatures: accessToken && accessToken.enabledFeatures,
    },
    packageFiles: files.filter(file => {
      return path.parse(file).base === 'package.json';
    }),
    packageLockFiles: files.filter(file => {
      return path.parse(file).base === 'package-lock.json';
    }),
    envFiles: files.filter(file => file.endsWith('.env')),
    jsonFiles: files.filter(file => path.extname(file) === '.json'),
    files,
  };

  console.log(util.inspect(output, false, 5, true));
};

exports.builder = yargs => yargs;

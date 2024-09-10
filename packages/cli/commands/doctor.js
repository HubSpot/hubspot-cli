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

// const i18nKey = 'commands.doctor';
exports.command = 'doctor';
exports.describe = 'The doctor is in';

exports.handler = async () => {
  const accountId = getAccountId();
  const projectConfig = await getProjectConfig();
  const { env, authType, personalAccessKey, accountType } = getAccountConfig(
    accountId
  );

  try {
    trackCommandUsage('doctor', null, accountId);
  } catch (e) {
    // eslint-disable-next-line no-empty
  }

  let accessToken = {};
  try {
    accessToken = await getAccessToken(personalAccessKey, env, accountId);
  } catch (e) {
    // eslint-disable-next-line no-empty
  }

  const files = (await walk(projectConfig.projectDir)).filter(file => {
    const { dir } = path.parse(file);
    return (
      !dir.includes('node_modules') &&
      !dir.includes('.husky') &&
      !dir.includes('.idea') &&
      !dir.includes('dist')
    );
  });

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
      npm: execSync('npm --version')
        .toString()
        .trim(),
    },
    projectConfig,
    account: {
      accountId,
      accountType,
      authType,
      name: accessToken.hubName,
      scopeGroups: accessToken.scopeGroups,
      enabledFeatures: accessToken.enabledFeatures,
    },
    files,
  };

  console.log(util.inspect(output, false, 5, true));
};

exports.builder = yargs => yargs;

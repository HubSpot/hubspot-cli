const { logger } = require('@hubspot/local-dev-lib/logger');
const pkg = require('../package.json');
const util = require('util');
const { getProjectConfig } = require('../lib/projects');
const { getAccountId } = require('../lib/commonOpts');
const { getAccessToken } = require('@hubspot/local-dev-lib/personalAccessKey');
const { trackCommandUsage } = require('../lib/usageTracking');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');
const execSync = require('child_process').execSync;
const { walk } = require('@hubspot/local-dev-lib/fs');

const i18nKey = 'commands.doctor';
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
  } catch (e) {}

  let accessToken = {};
  try {
    accessToken = await getAccessToken(personalAccessKey, env, accountId);
  } catch (e) {}

  console.log(
    (await walk(projectConfig.projectDir)).filter(file => {
      !file.includes('node_modules');
    })
  );
  const {
    platform,
    arch,
    versions: { node },
    mainModule: { path },
  } = process;

  const output = {
    platform,
    arch,
    path,
    versions: {
      '@hubspot/cli': pkg.version,
      node,
      npm: execSync('npm --version')
        .toString()
        .trim(),
    },
    projectConfig,
    account: {
      accountId: getAccountId(),
      name: accessToken.hubName,
      scopeGroups: accessToken.scopeGroups,
      enabledFeatures: accessToken.enabledFeatures,
    },
  };
  console.log(util.inspect(output, false, 5, true));
};

exports.builder = yargs => yargs;

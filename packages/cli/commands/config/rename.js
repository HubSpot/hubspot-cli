const { logger } = require('@hubspot/cli-lib/logger');
const { renameAccount } = require('@hubspot/cli-lib/lib/config');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  getAccountId,
  setLogLevel,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logDebugInfo } = require('../../lib/debugInfo');
const { validateAccount } = require('../../lib/validation');

const loadAndValidateOptions = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
};

exports.command = 'rename <portalName> <newName>';
exports.describe = 'Rename portal in config';

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { portalName, newName } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('functions-rename', {}, accountId);

  await renameAccount(portalName, newName);

  return logger.log(`Portal ${portalName} renamed to ${newName}`);
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  yargs.positional('portalName', {
    describe: 'Name of portal to be renamed.',
    type: 'string',
  });
  yargs.positional('newName', {
    describe: 'New name for portal.',
    type: 'string',
  });

  yargs.example([['$0 config rename myExistingPortalName myNewPortalName']]);

  return yargs;
};

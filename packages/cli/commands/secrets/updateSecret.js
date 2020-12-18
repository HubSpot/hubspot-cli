const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const {
  logServerlessFunctionApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cms-lib/errorHandlers');
const { updateSecret } = require('@hubspot/cms-lib/api/secrets');

const { validateAccount } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  setLogLevel,
  getAccountId,
} = require('../../lib/commonOpts');
const { logDebugInfo } = require('../../lib/debugInfo');
const { secretValuePrompt } = require('../../lib/secretPrompt');

exports.command = 'update <name>';
exports.describe = 'Update an existing HubSpot secret';

exports.handler = async options => {
  const { name: secretName, config: configPath } = options;

  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
  const accountId = getAccountId(options);
  trackCommandUsage('secrets-update', {}, accountId);

  try {
    const { secretValue } = await secretValuePrompt();

    await updateSecret(accountId, secretName, secretValue);
    logger.log(
      `The secret "${secretName}" was updated in the HubSpot account: ${accountId}`
    );
  } catch (e) {
    logger.error(`The secret "${secretName}" was not updated`);
    await logServerlessFunctionApiErrorInstance(
      accountId,
      e,
      new ApiErrorContext({
        request: 'update secret',
        accountId,
      })
    );
  }
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);
  yargs.positional('name', {
    describe: 'Name of the secret to be updated',
    type: 'string',
  });
  return yargs;
};

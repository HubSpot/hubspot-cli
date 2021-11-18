const { logger } = require('@hubspot/cli-lib/logger');
const {
  logServerlessFunctionApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { updateSecret } = require('@hubspot/cli-lib/api/secrets');

const { loadAndValidateOptions } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  getAccountId,
} = require('../../lib/commonOpts');
const { secretValuePrompt } = require('../../lib/secretPrompt');

exports.command = 'update <name>';
exports.describe = 'Update an existing HubSpot secret';

exports.handler = async options => {
  const { name: secretName } = options;

  await loadAndValidateOptions(options);

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

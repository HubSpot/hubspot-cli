const { logger } = require('@hubspot/cli-lib/logger');
const {
  logServerlessFunctionApiErrorInstance,
  ApiErrorContext,
} = require('../../lib/errorHandlers/apiErrors');
const { addSecret } = require('@hubspot/cli-lib/api/secrets');

const { loadAndValidateOptions } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  getAccountId,
} = require('../../lib/commonOpts');
const { uiAccountDescription } = require('../../lib/ui');
const { secretValuePrompt } = require('../../lib/prompts/secretPrompt');
const { i18n } = require('../../lib/lang');

const i18nKey = 'cli.commands.secrets.subcommands.add';

exports.command = 'add <name>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { name: secretName } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);
  trackCommandUsage('secrets-add', null, accountId);

  try {
    const { secretValue } = await secretValuePrompt();

    await addSecret(accountId, secretName, secretValue);
    logger.success(
      i18n(`${i18nKey}.success.add`, {
        accountIdentifier: uiAccountDescription(accountId),
        secretName,
      })
    );
  } catch (e) {
    logger.error(
      i18n(`${i18nKey}.errors.add`, {
        secretName,
      })
    );
    await logServerlessFunctionApiErrorInstance(
      accountId,
      e,
      new ApiErrorContext({
        request: 'add secret',
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
    describe: i18n(`${i18nKey}.positionals.name.describe`),
    type: 'string',
  });
  return yargs;
};

const { logger } = require('@hubspot/local-dev-lib/logger');
const { logError, ApiErrorContext } = require('../../lib/errorHandlers/index');
const { addSecret } = require('@hubspot/local-dev-lib/api/secrets');

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

const i18nKey = 'commands.secrets.subcommands.add';

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
  } catch (err) {
    logger.error(
      i18n(`${i18nKey}.errors.add`, {
        secretName,
      })
    );
    logError(
      err,
      new ApiErrorContext({
        request: 'add secret',
        accountId,
      })
    );
  }
};

exports.builder = yargs => {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);
  yargs.positional('name', {
    describe: i18n(`${i18nKey}.positionals.name.describe`),
    type: 'string',
  });
  return yargs;
};

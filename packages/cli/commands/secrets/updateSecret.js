const { logger } = require('@hubspot/cli-lib/logger');
const {
  logServerlessFunctionApiErrorInstance,
  ApiErrorContext,
} = require('../../lib/errorHandlers/apiErrors');
const { updateSecret } = require('@hubspot/cli-lib/api/secrets');

const { loadAndValidateOptions } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { uiAccountDescription } = require('../../lib/ui');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  getAccountId,
} = require('../../lib/commonOpts');
const { secretValuePrompt } = require('../../lib/prompts/secretPrompt');
const { i18n } = require('../../lib/lang');

const i18nKey = 'cli.commands.secrets.subcommands.update';

exports.command = 'update <name>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { name: secretName } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);
  trackCommandUsage('secrets-update', null, accountId);

  try {
    const { secretValue } = await secretValuePrompt();

    await updateSecret(accountId, secretName, secretValue);
    logger.success(
      i18n(`${i18nKey}.success.update`, {
        accountIdentifier: uiAccountDescription(accountId),
        secretName,
      })
    );
    logger.log(i18n(`${i18nKey}.success.updateExplanation`));
  } catch (e) {
    logger.error(
      i18n(`${i18nKey}.errors.update`, {
        secretName,
      })
    );
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
    describe: i18n(`${i18nKey}.positionals.name.describe`),
    type: 'string',
  });
  return yargs;
};

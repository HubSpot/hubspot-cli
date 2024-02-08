const { logger } = require('@hubspot/cli-lib/logger');
const {
  logServerlessFunctionApiErrorInstance,
  ApiErrorContext,
} = require('../../lib/errorHandlers/apiErrors');
const { deleteSecret } = require('@hubspot/cli-lib/api/secrets');

const { loadAndValidateOptions } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { uiAccountDescription } = require('../../lib/ui');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  getAccountId,
} = require('../../lib/commonOpts');
const { i18n } = require('../../lib/lang');

const i18nKey = 'cli.commands.secrets.subcommands.delete';

exports.command = 'delete <name>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { name: secretName } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);
  trackCommandUsage('secrets-delete', null, accountId);

  try {
    await deleteSecret(accountId, secretName);
    logger.success(
      i18n(`${i18nKey}.success.delete`, {
        accountIdentifier: uiAccountDescription(accountId),
        secretName,
      })
    );
  } catch (e) {
    logger.error(
      i18n(`${i18nKey}.errors.delete`, {
        secretName,
      })
    );
    await logServerlessFunctionApiErrorInstance(
      accountId,
      e,
      new ApiErrorContext({
        request: 'delete a secret',
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

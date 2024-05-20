const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  ApiErrorContext,
  logApiErrorInstance,
} = require('../../lib/errorHandlers/apiErrors');
const { deleteSecret } = require('@hubspot/local-dev-lib/api/secrets');

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

const i18nKey = 'commands.secrets.subcommands.delete';

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
  } catch (err) {
    logger.error(
      i18n(`${i18nKey}.errors.delete`, {
        secretName,
      })
    );
    logApiErrorInstance(
      err,
      new ApiErrorContext({
        request: 'delete a secret',
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

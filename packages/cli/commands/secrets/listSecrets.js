const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('../../lib/errorHandlers/apiErrors');
const { fetchSecrets } = require('@hubspot/local-dev-lib/api/secrets');

const { loadAndValidateOptions } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { uiAccountDescription } = require('../../lib/ui');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { i18n } = require('../../lib/lang');

const i18nKey = 'commands.secrets.subcommands.list';

exports.command = 'list';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { account } = options;
  trackCommandUsage('secrets-list', null, account);

  try {
    const { results } = await fetchSecrets(account);
    const groupLabel = i18n(`${i18nKey}.groupLabel`, {
      accountIdentifier: uiAccountDescription(account),
    });
    logger.group(groupLabel);
    results.forEach(secret => logger.log(secret));
    logger.groupEnd(groupLabel);
  } catch (err) {
    logger.error(i18n(`${i18nKey}.errors.list`));
    logApiErrorInstance(
      err,
      new ApiErrorContext({
        request: 'add secret',
        accountId: account,
      })
    );
  }
};

exports.builder = yargs => {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);
  return yargs;
};

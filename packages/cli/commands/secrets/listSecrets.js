const { logger } = require('@hubspot/local-dev-lib/logger');
const { logError, ApiErrorContext } = require('../../lib/errorHandlers/index');
const { fetchSecrets } = require('@hubspot/local-dev-lib/api/secrets');

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

const i18nKey = 'commands.secrets.subcommands.list';

exports.command = 'list';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);
  trackCommandUsage('secrets-list', null, accountId);

  try {
    const {
      data: { results },
    } = await fetchSecrets(accountId);
    const groupLabel = i18n(`${i18nKey}.groupLabel`, {
      accountIdentifier: uiAccountDescription(accountId),
    });
    logger.group(groupLabel);
    results.forEach(secret => logger.log(secret));
    logger.groupEnd(groupLabel);
  } catch (err) {
    logger.error(i18n(`${i18nKey}.errors.list`));
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
  return yargs;
};

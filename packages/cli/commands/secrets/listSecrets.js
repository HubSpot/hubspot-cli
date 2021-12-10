const { logger } = require('@hubspot/cli-lib/logger');
const {
  logServerlessFunctionApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { fetchSecrets } = require('@hubspot/cli-lib/api/secrets');

const { loadAndValidateOptions } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  getAccountId,
} = require('../../lib/commonOpts');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.secrets.subcommands.list';

exports.command = 'list';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);
  trackCommandUsage('secrets-list', {}, accountId);

  try {
    const { results } = await fetchSecrets(accountId);
    const groupLabel = i18n(`${i18nKey}.groupLabel`, {
      accountId,
    });
    logger.group(groupLabel);
    results.forEach(secret => logger.log(secret));
    logger.groupEnd(groupLabel);
  } catch (e) {
    logger.error(i18n(`${i18nKey}.errors.list`));
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
  return yargs;
};

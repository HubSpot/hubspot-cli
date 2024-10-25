// @ts-nocheck
const { deleteFile } = require('@hubspot/local-dev-lib/api/fileMapper');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { logError, ApiErrorContext } = require('../lib/errorHandlers/index');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} = require('../lib/commonOpts');
const { loadAndValidateOptions } = require('../lib/validation');
const { trackCommandUsage } = require('../lib/usageTracking');
const { i18n } = require('../lib/lang');

const i18nKey = 'commands.remove';

exports.command = 'remove <path>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { path: hsPath, account } = options;

  await loadAndValidateOptions(options);

  trackCommandUsage('remove', null, account);

  try {
    await deleteFile(account, hsPath);
    logger.log(
      i18n(`${i18nKey}.deleted`, { accountId: account, path: hsPath })
    );
  } catch (error) {
    logger.error(
      i18n(`${i18nKey}.errors.deleteFailed`, {
        accountId: account,
        path: hsPath,
      })
    );
    logError(
      error,
      new ApiErrorContext({
        accountId: account,
        request: hsPath,
      })
    );
  }
};

exports.builder = yargs => {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);
  yargs.positional('path', {
    describe: i18n(`${i18nKey}.positionals.path.describe`),
    type: 'string',
  });
  return yargs;
};

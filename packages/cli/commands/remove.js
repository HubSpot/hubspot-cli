const { deleteFile } = require('@hubspot/local-dev-lib/api/fileMapper');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('../lib/errorHandlers/apiErrors');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  getAccountId,
} = require('../lib/commonOpts');
const { loadAndValidateOptions } = require('../lib/validation');
const { trackCommandUsage } = require('../lib/usageTracking');
const { i18n } = require('../lib/lang');

const i18nKey = 'commands.remove';

exports.command = 'remove <path>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { path: hsPath } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('remove', null, accountId);

  try {
    await deleteFile(accountId, hsPath);
    logger.log(i18n(`${i18nKey}.deleted`, { accountId, path: hsPath }));
  } catch (error) {
    logger.error(
      i18n(`${i18nKey}.errors.deleteFailed`, { accountId, path: hsPath })
    );
    logApiErrorInstance(
      error,
      new ApiErrorContext({
        accountId,
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

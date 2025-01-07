// @ts-nocheck
const { deleteFile } = require('@hubspot/local-dev-lib/api/fileMapper');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { logError, ApiErrorContext } = require('../lib/errorHandlers/index');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  addGlobalOptions,
} = require('../lib/commonOpts');
const { trackCommandUsage } = require('../lib/usageTracking');
const { i18n } = require('../lib/lang');

const i18nKey = 'commands.remove';

exports.command = 'remove <path>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { path: hsPath, derivedAccountId } = options;

  trackCommandUsage('remove', null, derivedAccountId);

  try {
    await deleteFile(derivedAccountId, hsPath);
    logger.log(
      i18n(`${i18nKey}.deleted`, { accountId: derivedAccountId, path: hsPath })
    );
  } catch (error) {
    logger.error(
      i18n(`${i18nKey}.errors.deleteFailed`, {
        accountId: derivedAccountId,
        path: hsPath,
      })
    );
    logError(
      error,
      new ApiErrorContext({
        accountId: derivedAccountId,
        request: hsPath,
      })
    );
  }
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: i18n(`${i18nKey}.positionals.path.describe`),
    type: 'string',
  });

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);
  addGlobalOptions(yargs);

  return yargs;
};

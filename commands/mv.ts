// @ts-nocheck
const { logger } = require('@hubspot/local-dev-lib/logger');
const { moveFile } = require('@hubspot/local-dev-lib/api/fileMapper');
const { isSpecifiedError } = require('@hubspot/local-dev-lib/errors/index');
const { logError, ApiErrorContext } = require('../lib/errorHandlers/index');
const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  addGlobalOptions,
} = require('../lib/commonOpts');
const { trackCommandUsage } = require('../lib/usageTracking');
const { isPathFolder } = require('../lib/filesystem');
const { loadAndValidateOptions } = require('../lib/validation');
const { i18n } = require('../lib/lang');
const { uiBetaTag } = require('../lib/ui');

const i18nKey = 'commands.mv';

const getCorrectedDestPath = (srcPath, destPath) => {
  if (!isPathFolder(srcPath)) {
    return destPath;
  }

  // Makes sure that nested folders are moved independently
  return `${destPath}/${srcPath.split('/').pop()}`;
};

exports.command = 'mv <srcPath> <destPath>';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { srcPath, destPath, derivedAccountId } = options;

  trackCommandUsage('mv', null, derivedAccountId);

  try {
    await moveFile(
      derivedAccountId,
      srcPath,
      getCorrectedDestPath(srcPath, destPath)
    );
    logger.success(
      i18n(`${i18nKey}.move`, {
        accountId: derivedAccountId,
        destPath,
        srcPath,
      })
    );
  } catch (error) {
    logger.error(
      i18n(`${i18nKey}.errors.moveFailed`, {
        accountId: derivedAccountId,
        destPath,
        srcPath,
      })
    );
    if (isSpecifiedError(error, { statusCode: 409 })) {
      logger.error(
        i18n(`${i18nKey}.errors.sourcePathExists`, {
          destPath,
          srcPath,
        })
      );
    } else {
      logError(
        error,
        new ApiErrorContext({
          accountId: derivedAccountId,
          srcPath,
          destPath,
        })
      );
    }
  }
};

exports.builder = yargs => {
  yargs.positional('srcPath', {
    describe: 'Remote hubspot path',
    type: 'string',
  });
  yargs.positional('destPath', {
    describe: 'Remote hubspot path',
    type: 'string',
  });

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);
  addGlobalOptions(yargs);
  return yargs;
};

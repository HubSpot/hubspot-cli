// @ts-nocheck
const path = require('path');

const { logger } = require('@hubspot/local-dev-lib/logger');
const { logError } = require('../../lib/errorHandlers/index');
const { getCwd } = require('@hubspot/local-dev-lib/path');
const { createHubDbTable } = require('@hubspot/local-dev-lib/hubdb');

const {
  checkAndConvertToJson,
  loadAndValidateOptions,
} = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { addUseEnvironmentOptions } = require('../../lib/commonOpts');
const { i18n } = require('../../lib/lang');

const i18nKey = 'commands.hubdb.subcommands.create';
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

exports.command = 'create';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { path: providedFilePath, derivedAccountId } = options;

  await loadAndValidateOptions(options);

  trackCommandUsage('hubdb-create', null, derivedAccountId);

  try {
    const filePath = path.resolve(getCwd(), providedFilePath);
    if (!checkAndConvertToJson(filePath)) {
      process.exit(EXIT_CODES.ERROR);
    }

    const table = await createHubDbTable(
      derivedAccountId,
      path.resolve(getCwd(), providedFilePath)
    );
    logger.success(
      i18n(`${i18nKey}.success.create`, {
        accountId: derivedAccountId,
        rowCount: table.rowCount,
        tableId: table.tableId,
      })
    );
  } catch (e) {
    logger.error(
      i18n(`${i18nKey}.errors.create`, {
        providedFilePath,
      })
    );
    logError(e);
  }
};

exports.builder = yargs => {
  addUseEnvironmentOptions(yargs);

  yargs.options('path', {
    describe: i18n(`${i18nKey}.options.path.describe`),
    type: 'string',
  });
};

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
const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { i18n } = require('../../lib/lang');

const i18nKey = 'commands.hubdb.subcommands.create';
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

exports.command = 'create <src>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { src, account } = options;

  await loadAndValidateOptions(options);

  trackCommandUsage('hubdb-create', null, account);

  try {
    const filePath = path.resolve(getCwd(), src);
    if (!checkAndConvertToJson(filePath)) {
      process.exit(EXIT_CODES.ERROR);
    }

    const table = await createHubDbTable(account, path.resolve(getCwd(), src));
    logger.success(
      i18n(`${i18nKey}.success.create`, {
        accountId: account,
        rowCount: table.rowCount,
        tableId: table.tableId,
      })
    );
  } catch (e) {
    logger.error(
      i18n(`${i18nKey}.errors.create`, {
        src,
      })
    );
    logError(e);
  }
};

exports.builder = yargs => {
  addAccountOptions(yargs);
  addConfigOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs.positional('src', {
    describe: i18n(`${i18nKey}.positionals.src.describe`),
    type: 'string',
  });
};

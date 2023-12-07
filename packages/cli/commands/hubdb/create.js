const path = require('path');

const { logger } = require('@hubspot/cli-lib/logger');
const { logErrorInstance } = require('../../lib/errorHandlers/standardErrors');
const { getCwd } = require('@hubspot/local-dev-lib/path');
const { createHubDbTable } = require('@hubspot/cli-lib/hubdb');

const {
  isFileValidJSON,
  loadAndValidateOptions,
} = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  getAccountId,
} = require('../../lib/commonOpts');
const { i18n } = require('../../lib/lang');

const i18nKey = 'cli.commands.hubdb.subcommands.create';
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

exports.command = 'create <src>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { src } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('hubdb-create', null, accountId);

  try {
    const filePath = path.resolve(getCwd(), src);
    if (!isFileValidJSON(filePath)) {
      process.exit(EXIT_CODES.ERROR);
    }

    const table = await createHubDbTable(
      accountId,
      path.resolve(getCwd(), src)
    );
    logger.success(
      i18n(`${i18nKey}.success.create`, {
        accountId,
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
    logErrorInstance(e);
  }
};

exports.builder = yargs => {
  addAccountOptions(yargs, true);
  addConfigOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  yargs.positional('src', {
    describe: i18n(`${i18nKey}.positionals.src.describe`),
    type: 'string',
  });
};

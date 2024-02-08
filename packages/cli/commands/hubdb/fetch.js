const { logger } = require('@hubspot/cli-lib/logger');
const { logErrorInstance } = require('../../lib/errorHandlers/standardErrors');
const { downloadHubDbTable } = require('@hubspot/cli-lib/hubdb');

const { loadAndValidateOptions } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  getAccountId,
} = require('../../lib/commonOpts');
const { i18n } = require('../../lib/lang');

const i18nKey = 'cli.commands.hubdb.subcommands.fetch';

exports.command = 'fetch <tableId> [dest]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { tableId, dest } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('hubdb-fetch', null, accountId);

  try {
    const { filePath } = await downloadHubDbTable(accountId, tableId, dest);

    logger.success(
      i18n(`${i18nKey}.success.fetch`, {
        path: filePath,
        tableId,
      })
    );
  } catch (e) {
    logErrorInstance(e);
  }
};

exports.builder = yargs => {
  addAccountOptions(yargs, true);
  addConfigOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  yargs.positional('tableId', {
    describe: i18n(`${i18nKey}.positionals.tableId.describe`),
    type: 'string',
  });

  yargs.positional('dest', {
    describe: i18n(`${i18nKey}.positionals.dest.describe`),
    type: 'string',
  });
};

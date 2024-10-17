const { logger } = require('@hubspot/local-dev-lib/logger');
const { logApiErrorInstance } = require('../../lib/errorHandlers/apiErrors');
const { downloadHubDbTable } = require('@hubspot/local-dev-lib/hubdb');

const { loadAndValidateOptions } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { i18n } = require('../../lib/lang');

const i18nKey = 'commands.hubdb.subcommands.fetch';

exports.command = 'fetch <tableId> [dest]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { tableId, dest, account } = options;

  await loadAndValidateOptions(options);

  trackCommandUsage('hubdb-fetch', null, account);

  try {
    const { filePath } = await downloadHubDbTable(account, tableId, dest);

    logger.success(
      i18n(`${i18nKey}.success.fetch`, {
        path: filePath,
        tableId,
      })
    );
  } catch (e) {
    logApiErrorInstance(e);
  }
};

exports.builder = yargs => {
  addAccountOptions(yargs);
  addConfigOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs.positional('tableId', {
    describe: i18n(`${i18nKey}.positionals.tableId.describe`),
    type: 'string',
  });

  yargs.positional('dest', {
    describe: i18n(`${i18nKey}.positionals.dest.describe`),
    type: 'string',
  });
};

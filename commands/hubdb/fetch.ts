// @ts-nocheck
const { logger } = require('@hubspot/local-dev-lib/logger');
const { logError } = require('../../lib/errorHandlers/index');
const { downloadHubDbTable } = require('@hubspot/local-dev-lib/hubdb');
const {
  selectHubDBTablePrompt,
} = require('../../lib/prompts/selectHubDBTablePrompt');
const { loadAndValidateOptions } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { i18n } = require('../../lib/lang');

const i18nKey = 'commands.hubdb.subcommands.fetch';

exports.command = 'fetch [table-id] [dest]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { derivedAccountId } = options;

  await loadAndValidateOptions(options);

  trackCommandUsage('hubdb-fetch', null, derivedAccountId);

  try {
    const promptAnswers = await selectHubDBTablePrompt({
      accountId: derivedAccountId,
      options,
      skipDestPrompt: false,
    });
    const tableId = options.tableId || promptAnswers.tableId;
    const dest = options.dest || promptAnswers.dest;

    const { filePath } = await downloadHubDbTable(
      derivedAccountId,
      tableId,
      dest
    );

    logger.success(
      i18n(`${i18nKey}.success.fetch`, {
        path: filePath,
        tableId,
      })
    );
  } catch (e) {
    logError(e);
  }
};

exports.builder = yargs => {
  addAccountOptions(yargs);
  addConfigOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs.positional('table-id', {
    describe: i18n(`${i18nKey}.positionals.tableId.describe`),
    type: 'string',
  });

  yargs.positional('dest', {
    describe: i18n(`${i18nKey}.positionals.dest.describe`),
    type: 'string',
  });
};

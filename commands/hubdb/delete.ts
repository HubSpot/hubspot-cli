// @ts-nocheck
const { logger } = require('@hubspot/local-dev-lib/logger');
const { logError } = require('../../lib/errorHandlers/index');
const { deleteTable } = require('@hubspot/local-dev-lib/api/hubdb');
const { loadAndValidateOptions } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const {
  selectHubDBTablePrompt,
} = require('../../lib/prompts/selectHubDBTablePrompt');
const { promptUser } = require('../../lib/prompts/promptUtils');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { i18n } = require('../../lib/lang');

const i18nKey = 'commands.hubdb.subcommands.delete';

exports.command = 'delete [table-id]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { force, derivedAccountId } = options;

  await loadAndValidateOptions(options);

  trackCommandUsage('hubdb-delete', null, derivedAccountId);

  try {
    const { tableId } =
      'tableId' in options
        ? options
        : await selectHubDBTablePrompt({
            accountId: derivedAccountId,
            options,
            isDeleteCommand: true,
          });

    if (!force) {
      const { shouldDeleteTable } = await promptUser({
        name: 'shouldDeleteTable',
        type: 'confirm',
        message: i18n(`${i18nKey}.shouldDeleteTable`, { tableId }),
      });
      process.stdin.resume();

      if (!shouldDeleteTable) {
        process.exit(EXIT_CODES.SUCCESS);
      }
    }

    await deleteTable(derivedAccountId, tableId);
    logger.success(
      i18n(`${i18nKey}.success.delete`, {
        accountId: derivedAccountId,
        tableId,
      })
    );
    process.exit(EXIT_CODES.SUCCESS);
  } catch (e) {
    logger.error(
      i18n(`${i18nKey}.errors.delete`, {
        tableId,
      })
    );
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

  yargs.option('force', {
    describe: i18n(`${i18nKey}.options.force.describe`),
    type: 'boolean',
  });
};

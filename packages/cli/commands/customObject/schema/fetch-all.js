const { logger } = require('@hubspot/cli-lib/logger');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');

const { loadAndValidateOptions } = require('../../../lib/validation');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { getAccountId } = require('../../../lib/commonOpts');
const { downloadSchemas, getResolvedPath } = require('@hubspot/cli-lib/schema');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey =
  'cli.commands.customObject.subcommands.schema.subcommands.fetchAll';

exports.command = 'fetch-all [dest]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('custom-object-schema-fetch-all', null, accountId);

  try {
    await downloadSchemas(accountId, options.dest);
    logger.success(
      i18n(`${i18nKey}.success.fetch`, {
        path: getResolvedPath(options.dest),
      })
    );
  } catch (e) {
    logErrorInstance(e);
    logger.error(i18n(`${i18nKey}.errors.fetch`));
  }
};

exports.builder = yargs => {
  yargs.example([
    ['$0 custom-object schema fetch-all', i18n(`${i18nKey}.examples.default`)],
    [
      '$0 custom-object schema fetch-all my/folder',
      i18n(`${i18nKey}.examples.specifyPath`),
    ],
  ]);

  yargs.positional('dest', {
    describe: i18n(`${i18nKey}.positionals.dest.describe`),
    type: 'string',
  });
};

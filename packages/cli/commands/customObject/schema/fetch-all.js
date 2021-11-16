const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const { logger } = require('@hubspot/cli-lib/logger');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');

const { validateAccount } = require('../../../lib/validation');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { setLogLevel, getAccountId } = require('../../../lib/commonOpts');
const { logDebugInfo } = require('../../../lib/debugInfo');
const { downloadSchemas, getResolvedPath } = require('@hubspot/cli-lib/schema');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey =
  'cli.commands.customObject.subcommands.schema.subcommands.fetchAll';

exports.command = 'fetch-all [dest]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(options.config);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
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

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
const { deleteSchema } = require('@hubspot/cli-lib/api/schema');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey =
  'cli.commands.customObject.subcommands.schema.subcommands.delete';

exports.command = 'delete <name>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  let { name } = options;

  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(options.config);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
  const accountId = getAccountId(options);

  trackCommandUsage('custom-object-schema-delete', null, accountId);

  try {
    await deleteSchema(accountId, name);
    logger.success(
      i18n(`${i18nKey}.success.delete`, {
        name,
      })
    );
  } catch (e) {
    logErrorInstance(e);
    logger.error(
      i18n(`${i18nKey}.errors.delete`, {
        name,
      })
    );
  }
};

exports.builder = yargs => {
  yargs.example([
    ['$0 schema delete schemaName', i18n(`${i18nKey}.examples.default`)],
  ]);

  yargs.positional('name', {
    describe: i18n(`${i18nKey}.positionals.name.describe`),
    type: 'string',
  });
};

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
const { downloadSchema, getResolvedPath } = require('@hubspot/cli-lib/schema');

exports.command = 'fetch <name> [dest]';
exports.describe = 'Fetch a custom object schema';

exports.handler = async options => {
  let { name, dest } = options;

  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(options.config);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
  const accountId = getAccountId(options);

  trackCommandUsage('custom-object-schema-fetch', null, accountId);

  try {
    await downloadSchema(accountId, name, dest);
    logger.success(`Saved schema to ${getResolvedPath(dest, name)}`);
  } catch (e) {
    logErrorInstance(e);
    logger.error(`Unable to fetch ${name}`);
  }
};

exports.builder = yargs => {
  yargs.example([
    [
      '$0 custom-object schema fetch schemaId',
      'Fetch `schemaId` schema and put it in the current working directory',
    ],
    [
      '$0 custom-object schema fetch schemaId my/folder',
      'Fetch `schemaId` schema and put it in a directory named my/folder',
    ],
  ]);

  yargs.positional('name', {
    describe: 'Name of the target schema',
    type: 'string',
  });

  yargs.positional('dest', {
    describe: 'Local folder where schema will be written',
    type: 'string',
  });
};

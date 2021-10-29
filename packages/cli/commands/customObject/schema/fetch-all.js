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
const { EXIT_CODES } = require('../../../lib/exitCodes');

exports.command = 'fetch-all [dest]';
exports.describe = 'Fetch all custom object schemas for an account';

exports.handler = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(options.config);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(EXIT_CODES.ERROR);
  }
  const accountId = getAccountId(options);

  trackCommandUsage('custom-object-schema-fetch-all', null, accountId);

  try {
    await downloadSchemas(accountId, options.dest);
    logger.success(`Saved schemas to ${getResolvedPath(options.dest)}`);
  } catch (e) {
    logErrorInstance(e);
    logger.error('Unable to fetch schemas');
  }
};

exports.builder = yargs => {
  yargs.example([
    [
      '$0 custom-object schema fetch-all',
      'Fetch all schemas for an account and put them in the current working directory',
    ],
    [
      '$0 custom-object schema fetch-all my/folder',
      'Fetch all schemas for an account and put them in a directory named my/folder',
    ],
  ]);

  yargs.positional('dest', {
    describe: 'Local folder where schemas will be written',
    type: 'string',
  });
};

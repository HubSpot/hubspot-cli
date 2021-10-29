const {
  addAccountOptions,
  addConfigOptions,
  setLogLevel,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logDebugInfo } = require('../../lib/debugInfo');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const { logger } = require('@hubspot/cli-lib/logger');
const { start: startTestServer } = require('@hubspot/serverless-dev-runtime');
const { validateAccount } = require('../../lib/validation');
const { EXIT_CODES } = require('../../lib/exitCodes');

const loadAndValidateOptions = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(EXIT_CODES.ERROR);
  }
};

exports.command = 'server <path>';
exports.describe = false;

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { path: functionPath } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('functions-server', { functionPath }, accountId);

  logger.debug(
    `Starting local test server for .functions folder with path: ${functionPath}`
  );

  startTestServer({
    accountId,
    ...options,
  });
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: 'Path to local .functions folder',
    type: 'string',
  });
  yargs.option('port', {
    describe: 'port to run the test server on',
    type: 'string',
    default: 5432,
  });
  yargs.option('contact', {
    describe: 'pass contact data to the test function',
    type: 'boolean',
    default: true,
  });
  yargs.option('watch', {
    describe:
      'watch the specified .functions folder for changes and restart the server',
    type: 'boolean',
    default: true,
  });
  yargs.option('log-output', {
    describe:
      'output the response body from the serverless function execution (It is suggested not to use this in production environments as it can reveal any secure data returned by the function in logs)',
    type: 'boolean',
    default: false,
  });

  yargs.example([
    [
      '$0 functions server ./tmp/myFunctionFolder.functions',
      'Run a local function test server.',
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};

const { logger } = require('@hubspot/cli-lib/logger');
const { updateHttpTimeout } = require('@hubspot/cli-lib/lib/config');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');

const { getAccountId, setLogLevel } = require('../../../lib/commonOpts');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { logDebugInfo } = require('../../../lib/debugInfo');
const { validateAccount } = require('../../../lib/validation');

const loadAndValidateOptions = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
};

exports.command = 'http-timeout [timeout]';
exports.describe = 'Change http timeout used in config';

exports.handler = async options => {
  loadAndValidateOptions(options);

  const accountId = getAccountId(options);
  const { timeout } = options;

  trackCommandUsage('config-set-http-timeout', {}, accountId);

  updateHttpTimeout(timeout);

  return logger.log(`The http timeout has been set to: ${timeout}`);
};

exports.builder = yargs => {
  yargs.positional('timeout', {
    describe: 'Set http timeout value (in ms) in the config',
    type: 'string',
    default: 30000,
  });

  yargs.example([
    [
      '$0 config set http-timeout 30000',
      'Set the http timeout value in the config to 30000ms',
    ],
  ]);

  return yargs;
};

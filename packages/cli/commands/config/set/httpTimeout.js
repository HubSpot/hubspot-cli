const { logger } = require('@hubspot/cli-lib/logger');
const { updateHttpTimeout } = require('@hubspot/cli-lib/lib/config');

const { getAccountId } = require('../../../lib/commonOpts');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../../lib/validation');

exports.command = 'http-timeout [timeout]';
exports.describe = 'Change http timeout used in config';

exports.handler = async options => {
  await loadAndValidateOptions(options);

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

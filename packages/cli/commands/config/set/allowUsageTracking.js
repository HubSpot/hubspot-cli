const { logger } = require('@hubspot/cli-lib/logger');
const { updateAllowUsageTracking } = require('@hubspot/cli-lib/lib/config');
const inquirer = require('inquirer');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');

const { getAccountId, setLogLevel } = require('../../../lib/commonOpts');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { logDebugInfo } = require('../../../lib/debugInfo');
const { validateAccount } = require('../../../lib/validation');
const { EXIT_CODES } = require('../../../lib/exitCodes');

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

const enableOrDisableUsageTracking = async () => {
  const { isEnabled } = await inquirer.prompt([
    {
      type: 'list',
      look: false,
      name: 'isEnabled',
      pageSize: 20,
      message: 'Choose to enable or disable usage tracking',
      choices: [
        {
          name: 'Enabled',
          value: true,
        },
        { name: 'Disabled', value: false },
      ],
      default: true,
    },
  ]);

  return isEnabled;
};

exports.command = 'allow-usage-tracking';
exports.describe = 'Enable or disable usage tracking';

exports.handler = async options => {
  loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('config-set-allow-usage-tracking', {}, accountId);

  const isEnabled = await enableOrDisableUsageTracking();
  updateAllowUsageTracking(isEnabled);

  return logger.log(
    `Usage tracking is now ${isEnabled ? 'enabled' : 'disabled'}.`
  );
};

exports.builder = yargs => {
  yargs.example([
    [
      '$0 config set allow-usage-tracking',
      'Select to enable or disable usage tracking from a list',
    ],
  ]);

  return yargs;
};

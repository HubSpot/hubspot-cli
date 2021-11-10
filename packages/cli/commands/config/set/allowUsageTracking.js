const { logger } = require('@hubspot/cli-lib/logger');
const { updateAllowUsageTracking } = require('@hubspot/cli-lib/lib/config');
const inquirer = require('inquirer');

const { getAccountId } = require('../../../lib/commonOpts');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../../lib/validation');

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
  await loadAndValidateOptions(options);

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

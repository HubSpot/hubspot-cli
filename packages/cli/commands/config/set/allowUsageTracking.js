const { logger } = require('@hubspot/cli-lib/logger');
const { updateAllowUsageTracking } = require('@hubspot/cli-lib/lib/config');
const inquirer = require('inquirer');

const { getAccountId } = require('../../../lib/commonOpts');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../../lib/validation');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey =
  'cli.commands.config.subcommands.set.subcommands.allowUsageTracking';

const enableOrDisableUsageTracking = async () => {
  const { isEnabled } = await inquirer.prompt([
    {
      type: 'list',
      look: false,
      name: 'isEnabled',
      pageSize: 20,
      message: i18n(`${i18nKey}.promptMessage`),
      choices: [
        {
          name: i18n(`${i18nKey}.labels.enabled`),
          value: true,
        },
        {
          name: i18n(`${i18nKey}.labels.disabled`),
          value: false,
        },
      ],
      default: true,
    },
  ]);

  return isEnabled;
};

exports.command = 'allow-usage-tracking';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('config-set-allow-usage-tracking', {}, accountId);

  const isEnabled = await enableOrDisableUsageTracking();
  updateAllowUsageTracking(isEnabled);

  return logger.log(i18n(`${i18nKey}.${isEnabled ? 'enabled' : 'disabled'}`));
};

exports.builder = yargs => {
  yargs.example([
    ['$0 config set allow-usage-tracking', i18n(`${i18nKey}.examples.default`)],
  ]);

  return yargs;
};

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
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey =
  'cli.commands.config.subcommands.set.subcommands.allowUsageTracking';

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
  loadAndValidateOptions(options);

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

const { logger } = require('@hubspot/cli-lib/logger');
const { updateAllowUsageTracking } = require('@hubspot/local-dev-lib/config');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { promptUser } = require('../../../lib/prompts/promptUtils');
const { i18n } = require('../../../lib/lang');

const i18nKey =
  'cli.commands.config.subcommands.set.options.allowUsageTracking';

const enableOrDisableUsageTracking = async () => {
  const { isEnabled } = await promptUser([
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

const setAllowUsageTracking = async ({ accountId, allowUsageTracking }) => {
  trackCommandUsage('config-set-allow-usage-tracking', null, accountId);

  let isEnabled;

  if (typeof allowUsageTracking === 'boolean') {
    isEnabled = allowUsageTracking;
  } else {
    isEnabled = await enableOrDisableUsageTracking();
  }

  updateAllowUsageTracking(isEnabled);

  return logger.log(i18n(`${i18nKey}.success`, { isEnabled }));
};

module.exports = {
  setAllowUsageTracking,
};

// @ts-nocheck
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  updateAllowUsageTracking,
  updateDefaultCmsPublishMode,
  updateHttpTimeout,
} = require('@hubspot/local-dev-lib/config');
const { CMS_PUBLISH_MODE } = require('@hubspot/local-dev-lib/constants/files');
const { commaSeparatedValues } = require('@hubspot/local-dev-lib/text');
const { trackCommandUsage } = require('./usageTracking');
const { promptUser } = require('./prompts/promptUtils');
const { i18n } = require('../lib/lang');

const i18nKey = 'commands.config.subcommands.set.options';

const enableOrDisableUsageTracking = async () => {
  const { isEnabled } = await promptUser([
    {
      type: 'list',
      look: false,
      name: 'isEnabled',
      pageSize: 20,
      message: i18n(`${i18nKey}.allowUsageTracking.promptMessage`),
      choices: [
        {
          name: i18n(`${i18nKey}.allowUsageTracking.labels.enabled`),
          value: true,
        },
        {
          name: i18n(`${i18nKey}.allowUsageTracking.labels.disabled`),
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

  return logger.log(
    i18n(`${i18nKey}.allowUsageTracking.success`, { isEnabled })
  );
};

const ALL_CMS_PUBLISH_MODES = Object.values(CMS_PUBLISH_MODE);

const selectCmsPublishMode = async () => {
  const { cmsPublishMode } = await promptUser([
    {
      type: 'list',
      look: false,
      name: 'cmsPublishMode',
      pageSize: 20,
      message: i18n(`${i18nKey}.defaultMode.promptMessage`),
      choices: ALL_CMS_PUBLISH_MODES,
      default: CMS_PUBLISH_MODE.publish,
    },
  ]);

  return cmsPublishMode;
};

const setDefaultCmsPublishMode = async ({
  accountId,
  defaultCmsPublishMode,
}) => {
  trackCommandUsage('config-set-default-mode', null, accountId);

  let newDefault;

  if (!defaultCmsPublishMode) {
    newDefault = await selectCmsPublishMode();
  } else if (
    defaultCmsPublishMode &&
    ALL_CMS_PUBLISH_MODES.find(m => m === defaultCmsPublishMode)
  ) {
    newDefault = defaultCmsPublishMode;
  } else {
    logger.error(
      i18n(`${i18nKey}.defaultMode.errors`, {
        mode: newDefault,
        validModes: commaSeparatedValues(ALL_CMS_PUBLISH_MODES),
      })
    );
    newDefault = await selectCMsPublishMode();
  }

  updateDefaultCmsPublishMode(newDefault);

  return logger.success(
    i18n(`${i18nKey}.defaultMode.success`, {
      mode: newDefault,
    })
  );
};

const enterTimeout = async () => {
  const { timeout } = await promptUser([
    {
      name: 'timeout',
      message: i18n(`${i18nKey}.httpTimeout.promptMessage`),
      type: 'input',
      default: 30000,
    },
  ]);

  return timeout;
};

const setHttpTimeout = async ({ accountId, httpTimeout }) => {
  trackCommandUsage('config-set-http-timeout', null, accountId);

  let newHttpTimeout;

  if (!httpTimeout) {
    newHttpTimeout = await enterTimeout();
  } else {
    newHttpTimeout = httpTimeout;
  }

  updateHttpTimeout(newHttpTimeout);

  return logger.success(
    i18n(`${i18nKey}.httpTimeout.success`, { timeout: newHttpTimeout })
  );
};

module.exports = {
  setAllowUsageTracking,
  setDefaultCmsPublishMode,
  setHttpTimeout,
};

// @ts-nocheck
const { logger } = require('@hubspot/local-dev-lib/logger');
const { updateDefaultMode } = require('@hubspot/local-dev-lib/config');
const { MODE } = require('@hubspot/local-dev-lib/constants/files');
const { commaSeparatedValues } = require('@hubspot/local-dev-lib/text');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { promptUser } = require('../../../lib/prompts/promptUtils');
const { i18n } = require('../../../lib/lang');

const i18nKey = 'commands.config.subcommands.set.options.defaultMode';

const ALL_MODES = Object.values(MODE);

const selectMode = async () => {
  const { mode } = await promptUser([
    {
      type: 'list',
      look: false,
      name: 'mode',
      pageSize: 20,
      message: i18n(`${i18nKey}.promptMessage`),
      choices: ALL_MODES,
      default: MODE.publish,
    },
  ]);

  return mode;
};

const setDefaultMode = async ({ accountId, defaultMode }) => {
  trackCommandUsage('config-set-default-mode', null, accountId);

  let newDefault;

  if (!defaultMode) {
    newDefault = await selectMode();
  } else if (defaultMode && ALL_MODES.find(m => m === defaultMode)) {
    newDefault = defaultMode;
  } else {
    logger.error(
      i18n(`${i18nKey}.errors`, {
        mode: newDefault,
        validModes: commaSeparatedValues(ALL_MODES),
      })
    );
    newDefault = await selectMode();
  }

  updateDefaultMode(newDefault);

  return logger.success(
    i18n(`${i18nKey}.success`, {
      mode: newDefault,
    })
  );
};

module.exports = {
  setDefaultMode,
};

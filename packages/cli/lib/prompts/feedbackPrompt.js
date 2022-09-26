const { promptUser } = require('./promptUtils');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { FEEDBACK_OPTIONS } = require('@hubspot/cli-lib/lib/constants');

const i18nKey = 'cli.lib.prompts.feedbackPrompt';

const feedbackTypePrompt = () => {
  return promptUser([
    {
      name: 'type',
      message: i18n(`${i18nKey}.feedbackType.message`),
      type: 'list',
      choices: Object.values(FEEDBACK_OPTIONS).map(option => ({
        name: i18n(`${i18nKey}.feedbackType.${option}`),
        value: option,
      })),
    },
  ]);
};

const shouldOpenBrowserPrompt = type => {
  return promptUser([
    {
      name: 'shouldOpen',
      message: () => {
        return type === FEEDBACK_OPTIONS.BUG
          ? i18n(`${i18nKey}.bugPrompt`)
          : i18n(`${i18nKey}.generalPrompt`);
      },
      type: 'confirm',
    },
  ]);
};

module.exports = {
  feedbackTypePrompt,
  shouldOpenBrowserPrompt,
};

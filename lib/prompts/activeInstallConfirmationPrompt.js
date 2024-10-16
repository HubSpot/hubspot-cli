const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');

const i18nKey = 'lib.prompts.activeInstallConfirmationPrompt';

const activeInstallConfirmationPrompt = async () => {
  const { proceed } = await promptUser([
    {
      name: 'proceed',
      message: i18n(`${i18nKey}.message`),
      type: 'confirm',
      default: false,
    },
  ]);
  return proceed;
};

module.exports = {
  activeInstallConfirmationPrompt,
};

const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');

const i18nKey = 'lib.prompts.fetchProjectAssetPrompt';

const fetchProjectAssetPrompt = assetPath => {
  return promptUser({
    type: 'confirm',
    name: 'continue',
    message: i18n(`${i18nKey}.fetchConfirm`, { assetPath }),
    default: false,
  });
};

module.exports = {
  fetchProjectAssetPrompt,
};

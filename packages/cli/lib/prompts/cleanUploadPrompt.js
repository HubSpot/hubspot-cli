const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');

const i18nKey = 'cli.lib.prompts.cleanUploadPrompt';

const cleanUploadPrompt = async (accountId, filePath) => {
  const promptAnswer = await promptUser([
    {
      name: 'cleanUpload',
      message: i18n(`${i18nKey}.message`, { accountId, filePath }),
      type: 'confirm',
      default: false,
    },
  ]);
  return promptAnswer.cleanUpload;
};

module.exports = {
  cleanUploadPrompt,
};

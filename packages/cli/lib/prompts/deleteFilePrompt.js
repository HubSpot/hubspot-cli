const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');

const i18nKey = 'cli.lib.prompts.deletePrompt';

const deleteFilePrompt = async filePath => {
  const promptAnswer = await promptUser([
    {
      name: 'deleteFile',
      message: i18n(`${i18nKey}.message`, { filePath }),
      type: 'confirm',
      default: false,
    },
  ]);
  return promptAnswer.deleteFile;
};

module.exports = {
  deleteFilePrompt,
};

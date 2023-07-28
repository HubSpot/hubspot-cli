const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');

const i18nKey = 'cli.lib.prompts.overwritePrompt';

const overwriteFilePrompt = async filePath => {
  const promptAnswer = await promptUser([
    {
      name: 'overwriteFile',
      message: i18n(`${i18nKey}.message`, { filePath }),
      type: 'confirm',
      default: false,
    },
  ]);
  return promptAnswer.overwriteFile;
};

module.exports = {
  overwriteFilePrompt,
};

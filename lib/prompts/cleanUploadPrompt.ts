// @ts-nocheck
import inquirer from 'inquirer';
const { i18n } = require('../lang');

const i18nKey = 'lib.prompts.cleanUploadPrompt';

const cleanUploadPrompt = async (accountId, filePath) => {
  const promptAnswer = await inquirer.prompt([
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

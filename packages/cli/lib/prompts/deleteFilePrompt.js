//const path = require('path');
//const { getCwd } = require('@hubspot/cli-lib/path');
const { promptUser } = require('./promptUtils');
//const { i18n } = require('../lang');

//const i18nKey = 'cli.lib.prompts.deletePrompt';

const deleteFilePrompt = async filePath => {
  const promptAnswer = await promptUser([
    {
      name: 'deleteFile',
      message: `File ${filePath} does not exist locally. Would you like to delete it from HubSpot?`, // TODO: i18n this
      type: 'confirm',
      default: false,
    },
  ]);
  return promptAnswer.deleteFile;
};

module.exports = {
  deleteFilePrompt,
};

const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');

const i18nKey = 'cli.lib.prompts.folderOverwritePrompt';

const folderOverwritePrompt = folderName => {
  return promptUser({
    type: 'confirm',
    name: 'overwrite',
    message: i18n(`${i18nKey}.overwriteConfirm`, { folderName }),
    default: false,
  });
};

module.exports = {
  folderOverwritePrompt,
};

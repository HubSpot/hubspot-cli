const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');

const i18nKey = 'lib.prompts.localDevUploadPrompt';

const privateAppUploadPrompt = async () => {
  const { shouldUpload } = await promptUser({
    name: 'shouldUpload',
    type: 'confirm',
    message: i18n(`${i18nKey}.privateApp`),
  });
  return shouldUpload;
};

const publicAppUploadPrompt = async () => {
  const { shouldUpload } = await promptUser({
    name: 'shouldUpload',
    type: 'confirm',
    message: i18n(`${i18nKey}.publicApp`),
  });
  return shouldUpload;
};

module.exports = {
  privateAppUploadPrompt,
  publicAppUploadPrompt,
};

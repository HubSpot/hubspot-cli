const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');

const i18nKey = 'lib.prompts.localDevUploadPrompt';

const makeUploadPrompt = message => {
  return () => {
    let cancel;

    const promptPromise = new Promise(resolve => {
      cancel = () => {
        resolve(false);
        process.stdout.moveCursor(0, -1);
        process.stdout.clearLine(1);
      };

      promptUser({
        name: 'shouldUpload',
        type: 'confirm',
        message,
      }).then(({ shouldUpload }) => resolve(shouldUpload));
    });

    return { cancel, promptPromise };
  };
};

const publicAppUploadPrompt = makeUploadPrompt(i18n(`${i18nKey}.publicApp`));
const privateAppUploadPrompt = makeUploadPrompt(i18n(`${i18nKey}.privateApp`));

module.exports = {
  privateAppUploadPrompt,
  publicAppUploadPrompt,
};

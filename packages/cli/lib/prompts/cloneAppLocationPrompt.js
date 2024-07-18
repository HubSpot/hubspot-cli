const fs = require('fs');
const path = require('path');
const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');
const { getCwd, isValidPath } = require('@hubspot/local-dev-lib/path');

const i18nKey = 'lib.prompts.cloneAppLocationPrompt';

const cloneAppLocationPrompt = (promptOptions, appName) => {
  return promptUser({
    name: 'location',
    message: i18n(`${i18nKey}.enterLocation`),
    when: !promptOptions.location,
    default: path.resolve(getCwd(), appName),
    validate: input => {
      if (!input) {
        return i18n(`${i18nKey}.errors.locationRequired`);
      }
      if (fs.existsSync(input)) {
        return i18n(`${i18nKey}.errors.invalidLocation`);
      }
      if (!isValidPath(input)) {
        return i18n(`${i18nKey}.errors.invalidCharacters`);
      }
      return true;
    },
  });
};

module.exports = {
  cloneAppLocationPrompt,
};

const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');

const i18nKey = 'cli.lib.prompts.secretPrompt';

const SECRET_VALUE_PROMPT = {
  name: 'secretValue',
  type: 'password',
  mask: '*',
  message: i18n(`${i18nKey}.enterValue`),
  validate(val) {
    if (typeof val !== 'string') {
      return i18n(`${i18nKey}.errors.invalidValue`);
    }
    return true;
  },
};

function secretValuePrompt() {
  return promptUser([SECRET_VALUE_PROMPT]);
}

module.exports = {
  secretValuePrompt,
};

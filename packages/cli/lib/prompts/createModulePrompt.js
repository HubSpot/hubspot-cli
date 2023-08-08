const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');

const i18nKey = 'cli.lib.prompts.createModulePrompt';

const MODULE_LABEL_PROMPT = {
  name: 'moduleLabel',
  message: i18n(`${i18nKey}.enterLabel`),
  validate(val) {
    if (typeof val !== 'string') {
      return i18n(`${i18nKey}.errors.invalidLabel`);
    } else if (!val.length) {
      return i18n(`${i18nKey}.errors.labelRequired`);
    }
    return true;
  },
};
const CONTENT_TYPES_PROMPT = {
  type: 'checkbox',
  name: 'contentTypes',
  message: i18n(`${i18nKey}.selectContentType`),
  default: ['PAGE'],
  choices: [
    { name: 'Page', value: 'PAGE' },
    { name: 'Blog post', value: 'BLOG_POST' },
    { name: 'Blog listing', value: 'BLOG_LISTING' },
    { name: 'Email', value: 'EMAIL' },
  ],
  validate: input => {
    return new Promise(function(resolve, reject) {
      if (input.length > 0) {
        resolve(true);
      }
      reject(i18n(`${i18nKey}.errors.contentTypeRequired`));
    });
  },
};

const GLOBAL_PROMPT = {
  type: 'confirm',
  name: 'global',
  message: i18n(`${i18nKey}.confirmGlobal`),
  default: false,
};

function createModulePrompt() {
  return promptUser([MODULE_LABEL_PROMPT, CONTENT_TYPES_PROMPT, GLOBAL_PROMPT]);
}

module.exports = {
  createModulePrompt,
};

const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');

const i18nKey = 'lib.prompts.createModulePrompt';

const MODULE_LABEL_PROMPT = {
  name: 'moduleLabel',
  message: i18n(`${i18nKey}.enterLabel`),
  validate(val: string): boolean | string {
    if (typeof val !== 'string') {
      return i18n(`${i18nKey}.errors.invalidLabel`);
    } else if (!val.length) {
      return i18n(`${i18nKey}.errors.labelRequired`);
    }
    return true;
  },
};

const REACT_TYPE_PROMPT = {
  type: 'confirm',
  name: 'reactType',
  message: i18n(`${i18nKey}.selectReactType`),
  default: false,
};

const CONTENT_TYPES_PROMPT = {
  type: 'checkbox',
  name: 'contentTypes',
  message: i18n(`${i18nKey}.selectContentType`),
  default: ['ANY'],
  choices: [
    { name: 'Any', value: 'ANY' },
    { name: 'Landing page', value: 'LANDING_PAGE' },
    { name: 'Site page', value: 'SITE_PAGE' },
    { name: 'Blog post', value: 'BLOG_POST' },
    { name: 'Blog listing', value: 'BLOG_LISTING' },
    { name: 'Email', value: 'EMAIL' },
    { name: 'Knowledge base', value: 'KNOWLEDGE_BASE' },
    { name: 'Quote template', value: 'QUOTE_TEMPLATE' },
    { name: 'Customer portal', value: 'CUSTOMER_PORTAL' },
    { name: 'Web interactive', value: 'WEB_INTERACTIVE' },
    { name: 'Subscription', value: 'SUBSCRIPTION' },
    { name: 'Membership', value: 'MEMBERSHIP' },
  ],
  validate: (input: string[]): Promise<boolean | string> => {
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

const AVAILABLE_FOR_NEW_CONTENT = {
  type: 'confirm',
  name: 'availableForNewContent',
  message: i18n(`${i18nKey}.availableForNewContent`),
  default: true,
};

export function createModulePrompt() {
  return promptUser([
    MODULE_LABEL_PROMPT,
    REACT_TYPE_PROMPT,
    CONTENT_TYPES_PROMPT,
    GLOBAL_PROMPT,
    AVAILABLE_FOR_NEW_CONTENT,
  ]);
}

const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');

const i18nKey = 'cli.lib.prompts.createTemplatePrompt';

const TEMPLATE_TYPE_PROMPT = {
  type: 'list',
  name: 'templateType',
  message: i18n(`${i18nKey}.selectTemplate`),
  default: 'page',
  choices: [
    { name: 'page', value: 'page-template' },
    { name: 'email', value: 'email-template' },
    { name: 'partial', value: 'partial' },
    { name: 'global partial', value: 'global-partial' },
    { name: 'blog listing', value: 'blog-listing-template' },
    { name: 'blog post', value: 'blog-post-template' },
    { name: 'search results', value: 'search-template' },
  ],
};

function createTemplatePrompt() {
  return promptUser([TEMPLATE_TYPE_PROMPT]);
}

module.exports = {
  createTemplatePrompt,
};

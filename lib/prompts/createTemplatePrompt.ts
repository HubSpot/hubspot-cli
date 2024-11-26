import { promptUser } from './promptUtils';
import { i18n } from '../lang';

const i18nKey = 'lib.prompts.createTemplatePrompt';

const templateTypeChoices = [
  { name: 'page', value: 'page-template' },
  { name: 'email', value: 'email-template' },
  { name: 'partial', value: 'partial' },
  { name: 'global partial', value: 'global-partial' },
  { name: 'blog listing', value: 'blog-listing-template' },
  { name: 'blog post', value: 'blog-post-template' },
  { name: 'search results', value: 'search-template' },
] as const;

const TEMPLATE_TYPE_PROMPT = {
  type: 'list',
  name: 'templateType',
  message: i18n(`${i18nKey}.selectTemplate`),
  default: 'page',
  choices: templateTypeChoices,
};

interface CreateTemplatePromptResponse {
  templateType: typeof templateTypeChoices[number]['value'];
}

export function createTemplatePrompt(): Promise<CreateTemplatePromptResponse> {
  return promptUser([TEMPLATE_TYPE_PROMPT]);
}

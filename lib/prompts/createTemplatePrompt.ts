import { promptUser } from './promptUtils';
import { i18n } from '../lang';
import { PromptChoices, PromptConfig } from '../../types/Prompts';


const templateTypeChoices = [
  { name: 'page', value: 'page-template' },
  { name: 'email', value: 'email-template' },
  { name: 'partial', value: 'partial' },
  { name: 'global partial', value: 'global-partial' },
  { name: 'blog listing', value: 'blog-listing-template' },
  { name: 'blog post', value: 'blog-post-template' },
  { name: 'search results', value: 'search-template' },
] satisfies PromptChoices;

interface CreateTemplatePromptResponse {
  templateType: (typeof templateTypeChoices)[number]['value'];
}

const TEMPLATE_TYPE_PROMPT: PromptConfig<CreateTemplatePromptResponse> = {
  type: 'list',
  name: 'templateType',
  message: i18n(`lib.prompts.createTemplatePrompt.selectTemplate`),
  default: 'page',
  choices: templateTypeChoices,
};

export function createTemplatePrompt(): Promise<CreateTemplatePromptResponse> {
  return promptUser<CreateTemplatePromptResponse>([TEMPLATE_TYPE_PROMPT]);
}

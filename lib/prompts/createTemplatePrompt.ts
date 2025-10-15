import { promptUser } from './promptUtils.js';
import { lib } from '../../lang/en.js';
import { PromptChoices, PromptConfig } from '../../types/Prompts.js';
import { CreateArgs, TemplateType } from '../../types/Cms.js';

const templateTypeChoices = [
  { name: 'page', value: 'page-template' },
  { name: 'email', value: 'email-template' },
  { name: 'partial', value: 'partial' },
  { name: 'global partial', value: 'global-partial' },
  { name: 'blog listing', value: 'blog-listing-template' },
  { name: 'blog post', value: 'blog-post-template' },
  { name: 'search results', value: 'search-template' },
  { name: 'section', value: 'section' },
] as const satisfies PromptChoices;

interface CreateTemplatePromptResponse {
  templateType: TemplateType;
}

const TEMPLATE_TYPE_PROMPT: PromptConfig<CreateTemplatePromptResponse> = {
  type: 'list',
  name: 'templateType',
  message: lib.prompts.createTemplatePrompt.selectTemplate,
  default: 'page',
  choices: templateTypeChoices,
};

export function createTemplatePrompt(
  commandArgs: Partial<CreateArgs> = {}
): Promise<CreateTemplatePromptResponse> {
  // If templateType is provided, return it directly
  if (commandArgs.templateType) {
    return Promise.resolve({
      templateType: commandArgs.templateType,
    });
  }

  // No templateType provided, prompt for it (original behavior)
  return promptUser<CreateTemplatePromptResponse>([TEMPLATE_TYPE_PROMPT]);
}

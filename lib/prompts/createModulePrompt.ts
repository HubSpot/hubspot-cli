import { PromptConfig } from '../../types/Prompts';

import { promptUser } from './promptUtils';
import { i18n } from '../lang';

type CreateModulePromptResponse = {
  moduleLabel: string;
  reactType: boolean;
  contentTypes: string[];
  global: boolean;
  availableForNewContent: boolean;
};

const MODULE_LABEL_PROMPT: PromptConfig<CreateModulePromptResponse> = {
  name: 'moduleLabel',
  message: i18n(`lib.prompts.createModulePrompt.enterLabel`),
  validate(val?: string): boolean | string {
    if (typeof val !== 'string') {
      return i18n(`lib.prompts.createModulePrompt.errors.invalidLabel`);
    } else if (!val.length) {
      return i18n(`lib.prompts.createModulePrompt.errors.labelRequired`);
    }
    return true;
  },
};

const REACT_TYPE_PROMPT: PromptConfig<CreateModulePromptResponse> = {
  type: 'confirm',
  name: 'reactType',
  message: i18n(`lib.prompts.createModulePrompt.selectReactType`),
  default: false,
};

const CONTENT_TYPES_PROMPT: PromptConfig<CreateModulePromptResponse> = {
  type: 'checkbox',
  name: 'contentTypes',
  message: i18n(`lib.prompts.createModulePrompt.selectContentType`),
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
  validate: (input: string[]) => {
    return new Promise<string | boolean>(function (resolve, reject) {
      if (input.length > 0) {
        resolve(true);
      }
      reject(i18n(`lib.prompts.createModulePrompt.errors.contentTypeRequired`));
    });
  },
};

const GLOBAL_PROMPT: PromptConfig<CreateModulePromptResponse> = {
  type: 'confirm',
  name: 'global',
  message: i18n(`lib.prompts.createModulePrompt.confirmGlobal`),
  default: false,
};

const AVAILABLE_FOR_NEW_CONTENT: PromptConfig<CreateModulePromptResponse> = {
  type: 'confirm',
  name: 'availableForNewContent',
  message: i18n(`lib.prompts.createModulePrompt.availableForNewContent`),
  default: true,
};

export function createModulePrompt(): Promise<CreateModulePromptResponse> {
  return promptUser<CreateModulePromptResponse>([
    MODULE_LABEL_PROMPT,
    REACT_TYPE_PROMPT,
    CONTENT_TYPES_PROMPT,
    GLOBAL_PROMPT,
    AVAILABLE_FOR_NEW_CONTENT,
  ]);
}

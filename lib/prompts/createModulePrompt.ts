import { PromptConfig } from '../../types/Prompts.js';

import { promptUser } from './promptUtils.js';
import { lib } from '../../lang/en.js';
import { CreateArgs } from '../../types/Cms.js';

type CreateModulePromptResponse = {
  moduleLabel: string;
  reactType: boolean;
  contentTypes: string[];
  global: boolean;
  availableForNewContent: boolean;
};

const MODULE_LABEL_PROMPT: PromptConfig<CreateModulePromptResponse> = {
  name: 'moduleLabel',
  message: lib.prompts.createModulePrompt.enterLabel,
  validate(val?: string): boolean | string {
    if (typeof val !== 'string') {
      return lib.prompts.createModulePrompt.errors.invalidLabel;
    } else if (!val.length) {
      return lib.prompts.createModulePrompt.errors.labelRequired;
    }
    return true;
  },
};

const REACT_TYPE_PROMPT: PromptConfig<CreateModulePromptResponse> = {
  type: 'confirm',
  name: 'reactType',
  message: lib.prompts.createModulePrompt.selectReactType,
  default: false,
};

const CONTENT_TYPES_PROMPT: PromptConfig<CreateModulePromptResponse> = {
  type: 'checkbox',
  name: 'contentTypes',
  message: lib.prompts.createModulePrompt.selectContentType,
  choices: [
    { name: 'Any', value: 'ANY', checked: true },
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
      reject(lib.prompts.createModulePrompt.errors.contentTypeRequired);
    });
  },
};

const GLOBAL_PROMPT: PromptConfig<CreateModulePromptResponse> = {
  type: 'confirm',
  name: 'global',
  message: lib.prompts.createModulePrompt.confirmGlobal,
  default: false,
};

const AVAILABLE_FOR_NEW_CONTENT: PromptConfig<CreateModulePromptResponse> = {
  type: 'confirm',
  name: 'availableForNewContent',
  message: lib.prompts.createModulePrompt.availableForNewContent,
  default: true,
};

export function createModulePrompt(
  commandArgs: Partial<CreateArgs> = {}
): Promise<CreateModulePromptResponse> {
  // Check if moduleLabel is provided (main requirement to skip full prompting)
  // but still allow individual parameter prompting for enhanced UX
  if (commandArgs.moduleLabel) {
    const prompts: PromptConfig<CreateModulePromptResponse>[] = [];

    // Only prompt for parameters not explicitly provided
    if (commandArgs.reactType === undefined) {
      prompts.push(REACT_TYPE_PROMPT);
    }

    if (!commandArgs.contentTypes) {
      prompts.push(CONTENT_TYPES_PROMPT);
    }

    if (commandArgs.global === undefined) {
      prompts.push(GLOBAL_PROMPT);
    }

    if (commandArgs.availableForNewContent === undefined) {
      prompts.push(AVAILABLE_FOR_NEW_CONTENT);
    }

    // If no additional prompts needed, return with defaults
    if (prompts.length === 0) {
      const contentTypesArray = commandArgs.contentTypes
        ? commandArgs.contentTypes.split(',').map((t: string) => t.trim())
        : ['ANY'];

      return Promise.resolve({
        moduleLabel: commandArgs.moduleLabel!,
        reactType: commandArgs.reactType ?? false,
        contentTypes: contentTypesArray,
        global: commandArgs.global ?? false,
        availableForNewContent: commandArgs.availableForNewContent ?? true,
      });
    }

    // Prompt only for missing optional parameters
    return promptUser<CreateModulePromptResponse>(prompts).then(
      promptResponse => {
        const contentTypesArray = commandArgs.contentTypes
          ? commandArgs.contentTypes.split(',').map((t: string) => t.trim())
          : promptResponse.contentTypes || ['ANY'];

        return {
          moduleLabel: commandArgs.moduleLabel!,
          reactType: commandArgs.reactType ?? promptResponse.reactType ?? false,
          contentTypes: contentTypesArray,
          global: commandArgs.global ?? promptResponse.global ?? false,
          availableForNewContent:
            commandArgs.availableForNewContent ??
            promptResponse.availableForNewContent ??
            true,
        };
      }
    );
  }

  // No moduleLabel provided, prompt for everything (original behavior)
  return promptUser<CreateModulePromptResponse>([
    MODULE_LABEL_PROMPT,
    REACT_TYPE_PROMPT,
    CONTENT_TYPES_PROMPT,
    GLOBAL_PROMPT,
    AVAILABLE_FOR_NEW_CONTENT,
  ]);
}

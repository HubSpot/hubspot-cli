import { promptUser } from './promptUtils.js';
import { i18n } from '../lang.js';
import { PromptConfig } from '../../types/Prompts.js';
import { CreateArgs } from '../../types/Cms.js';

type CreateFunctionPromptResponse = {
  functionsFolder: string;
  filename: string;
  endpointMethod: string;
  endpointPath: string;
};

const FUNCTIONS_FOLDER_PROMPT: PromptConfig<CreateFunctionPromptResponse> = {
  name: 'functionsFolder',
  message: i18n(`lib.prompts.createFunctionPrompt.enterFolder`),
  validate(val?: string) {
    if (typeof val !== 'string') {
      return i18n(`lib.prompts.createFunctionPrompt.errors.invalid`);
    } else if (!val.length) {
      return i18n(`lib.prompts.createFunctionPrompt.errors.blank`);
    } else if (val.indexOf(' ') >= 0) {
      return i18n(`lib.prompts.createFunctionPrompt.errors.space`);
    }
    return true;
  },
};

const FUNCTION_FILENAME_PROMPT: PromptConfig<CreateFunctionPromptResponse> = {
  name: 'filename',
  message: i18n(`lib.prompts.createFunctionPrompt.enterFilename`),
  validate(val?: string) {
    if (typeof val !== 'string') {
      return i18n(`lib.prompts.createFunctionPrompt.errors.invalid`);
    } else if (!val.length) {
      return i18n(`lib.prompts.createFunctionPrompt.errors.blank`);
    } else if (val.indexOf(' ') >= 0) {
      return i18n(`lib.prompts.createFunctionPrompt.errors.space`);
    }
    return true;
  },
};

const ENDPOINT_METHOD_PROMPT: PromptConfig<CreateFunctionPromptResponse> = {
  type: 'list',
  name: 'endpointMethod',
  message: i18n(`lib.prompts.createFunctionPrompt.selectEndpointMethod`),
  default: 'GET',
  choices: ['DELETE', 'GET', 'PATCH', 'POST', 'PUT'],
};

const ENDPOINT_PATH_PROMPT: PromptConfig<CreateFunctionPromptResponse> = {
  name: 'endpointPath',
  message: i18n(`lib.prompts.createFunctionPrompt.enterEndpointPath`),
  validate(val?: string) {
    if (typeof val !== 'string') {
      return i18n(`lib.prompts.createFunctionPrompt.errors.invalid`);
    } else if (!val.length) {
      return i18n(`lib.prompts.createFunctionPrompt.errors.blank`);
    } else if (val.indexOf(' ') >= 0) {
      return i18n(`lib.prompts.createFunctionPrompt.errors.space`);
    }
    return true;
  },
};

export function createFunctionPrompt(
  commandArgs: Partial<CreateArgs> = {}
): Promise<CreateFunctionPromptResponse> {
  // Check if all required parameters are provided (endpointMethod has default)
  const hasAllRequired =
    commandArgs.functionsFolder &&
    commandArgs.filename &&
    commandArgs.endpointPath;

  if (hasAllRequired) {
    return Promise.resolve({
      functionsFolder: commandArgs.functionsFolder!,
      filename: commandArgs.filename!,
      endpointMethod: commandArgs.endpointMethod || 'GET',
      endpointPath: commandArgs.endpointPath!,
    });
  }

  const prompts: PromptConfig<CreateFunctionPromptResponse>[] = [];

  // Only prompt for missing parameters
  if (!commandArgs.functionsFolder) {
    prompts.push(FUNCTIONS_FOLDER_PROMPT);
  }

  if (!commandArgs.filename) {
    prompts.push(FUNCTION_FILENAME_PROMPT);
  }

  if (!commandArgs.endpointMethod) {
    prompts.push(ENDPOINT_METHOD_PROMPT);
  }

  if (!commandArgs.endpointPath) {
    prompts.push(ENDPOINT_PATH_PROMPT);
  }

  return promptUser<CreateFunctionPromptResponse>(prompts).then(
    promptResponse => {
      // Merge prompted values with provided commandArgs
      return {
        functionsFolder:
          commandArgs.functionsFolder || promptResponse.functionsFolder,
        filename: commandArgs.filename || promptResponse.filename,
        endpointMethod:
          commandArgs.endpointMethod || promptResponse.endpointMethod || 'GET',
        endpointPath: commandArgs.endpointPath || promptResponse.endpointPath,
      };
    }
  );
}

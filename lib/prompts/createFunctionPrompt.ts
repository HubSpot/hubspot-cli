import { promptUser } from './promptUtils';
import { i18n } from '../lang';
import { PromptConfig } from '../../types/Prompts';


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

export function createFunctionPrompt(): Promise<CreateFunctionPromptResponse> {
  return promptUser<CreateFunctionPromptResponse>([
    FUNCTIONS_FOLDER_PROMPT,
    FUNCTION_FILENAME_PROMPT,
    ENDPOINT_METHOD_PROMPT,
    ENDPOINT_PATH_PROMPT,
  ]);
}

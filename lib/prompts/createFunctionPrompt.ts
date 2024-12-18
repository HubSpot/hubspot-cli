import { promptUser } from './promptUtils';
import { i18n } from '../lang';
import { PromptConfig } from '../../types/Prompts';

const i18nKey = 'lib.prompts.createFunctionPrompt';

type CreateFunctionPromptResponse = {
  functionsFolder: string;
  filename: string;
  endpointMethod: string;
  endpointPath: string;
};

const FUNCTIONS_FOLDER_PROMPT: PromptConfig<CreateFunctionPromptResponse> = {
  name: 'functionsFolder',
  message: i18n(`${i18nKey}.enterFolder`),
  validate(val?: string) {
    if (typeof val !== 'string') {
      return i18n(`${i18nKey}.errors.invalid`);
    } else if (!val.length) {
      return i18n(`${i18nKey}.errors.blank`);
    } else if (val.indexOf(' ') >= 0) {
      return i18n(`${i18nKey}.errors.space`);
    }
    return true;
  },
};

const FUNCTION_FILENAME_PROMPT: PromptConfig<CreateFunctionPromptResponse> = {
  name: 'filename',
  message: i18n(`${i18nKey}.enterFilename`),
  validate(val?: string) {
    if (typeof val !== 'string') {
      return i18n(`${i18nKey}.errors.invalid`);
    } else if (!val.length) {
      return i18n(`${i18nKey}.errors.blank`);
    } else if (val.indexOf(' ') >= 0) {
      return i18n(`${i18nKey}.errors.space`);
    }
    return true;
  },
};

const ENDPOINT_METHOD_PROMPT: PromptConfig<CreateFunctionPromptResponse> = {
  type: 'list',
  name: 'endpointMethod',
  message: i18n(`${i18nKey}.selectEndpointMethod`),
  default: 'GET',
  choices: ['DELETE', 'GET', 'PATCH', 'POST', 'PUT'],
};

const ENDPOINT_PATH_PROMPT: PromptConfig<CreateFunctionPromptResponse> = {
  name: 'endpointPath',
  message: i18n(`${i18nKey}.enterEndpointPath`),
  validate(val?: string) {
    if (typeof val !== 'string') {
      return i18n(`${i18nKey}.errors.invalid`);
    } else if (!val.length) {
      return i18n(`${i18nKey}.errors.blank`);
    } else if (val.indexOf(' ') >= 0) {
      return i18n(`${i18nKey}.errors.space`);
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

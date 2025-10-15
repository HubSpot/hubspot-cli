import { promptUser } from './promptUtils.js';
import { lib } from '../../lang/en.js';
import { PromptConfig } from '../../types/Prompts.js';
import { ApiSampleChoice, ApiSampleConfig } from '../../types/Cms.js';

type SampleTypePromptResponse = {
  sampleType?: string;
};

type LanguagePromptResponse = {
  sampleLanguage?: string;
};

type CreateApiSamplePromptResponse = SampleTypePromptResponse &
  LanguagePromptResponse;

function getSampleTypesPrompt(
  choices: ApiSampleChoice[]
): PromptConfig<SampleTypePromptResponse> {
  return {
    type: 'rawlist',
    name: 'sampleType',
    message: lib.prompts.createApiSamplePrompt.selectApiSampleApp,
    choices: choices.map(choice => ({
      name: `${choice.name} - ${choice.description}`,
      value: choice.id,
    })),
    validate: function (input?: string) {
      return new Promise<boolean>(function (resolve, reject) {
        if (input && input.length > 0) {
          resolve(true);
        } else {
          reject(lib.prompts.createApiSamplePrompt.errors.apiSampleAppRequired);
        }
      });
    },
  };
}

function getLanguagesPrompt(
  choices: string[]
): PromptConfig<LanguagePromptResponse> {
  return {
    type: 'rawlist',
    name: 'sampleLanguage',
    message: lib.prompts.createApiSamplePrompt.selectLanguage,
    choices: choices.map(choice => ({
      name: choice,
      value: choice,
    })),
    validate: function (input: string | undefined) {
      return new Promise<boolean>(function (resolve, reject) {
        if (input && input.length > 0) {
          resolve(true);
        }
        reject(lib.prompts.createApiSamplePrompt.errors.languageRequired);
      });
    },
  };
}

export async function createApiSamplePrompt(
  samplesConfig: ApiSampleConfig
): Promise<CreateApiSamplePromptResponse> {
  try {
    const { samples } = samplesConfig;
    const sampleTypeAnswer = await promptUser<SampleTypePromptResponse>(
      getSampleTypesPrompt(samples)
    );
    const chosenSample = samples.find(
      sample => sample.id === sampleTypeAnswer.sampleType
    );
    const { languages } = chosenSample!;
    const languagesAnswer = await promptUser<LanguagePromptResponse>(
      getLanguagesPrompt(languages)
    );
    return {
      ...sampleTypeAnswer,
      ...languagesAnswer,
    };
  } catch (e) {
    return {};
  }
}

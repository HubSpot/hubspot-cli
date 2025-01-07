import { promptUser } from './promptUtils';
import { i18n } from '../lang';
import { PromptConfig } from '../../types/Prompts';

const i18nKey = 'lib.prompts.createApiSamplePrompt';

type SampleChoice = {
  name: string;
  description: string;
  id: string;
  languages: string[];
};

type SampleConfig = {
  samples: SampleChoice[];
};

type SampleTypePromptResponse = {
  sampleType?: string;
};

type LanguagePromptResponse = {
  sampleLanguage?: string;
};

type CreateApiSamplePromptResponse = SampleTypePromptResponse &
  LanguagePromptResponse;

function getSampleTypesPrompt(
  choices: SampleChoice[]
): PromptConfig<SampleTypePromptResponse> {
  return {
    type: 'rawlist',
    name: 'sampleType',
    message: i18n(`${i18nKey}.selectApiSampleApp`),
    choices: choices.map(choice => ({
      name: `${choice.name} - ${choice.description}`,
      value: choice.id,
    })),
    validate: function (input?: string) {
      return new Promise<boolean>(function (resolve, reject) {
        if (input && input.length > 0) {
          resolve(true);
        } else {
          reject(i18n(`${i18nKey}.errors.apiSampleAppRequired`));
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
    message: i18n(`${i18nKey}.selectLanguage`),
    choices: choices.map(choice => ({
      name: choice,
      value: choice,
    })),
    validate: function (input: string | undefined) {
      return new Promise<boolean>(function (resolve, reject) {
        if (input && input.length > 0) {
          resolve(true);
        }
        reject(i18n(`${i18nKey}.errors.languageRequired`));
      });
    },
  };
}

export async function createApiSamplePrompt(
  samplesConfig: SampleConfig
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

import { promptUser } from './promptUtils';
import { i18n } from '../lang';

const i18nKey = 'lib.prompts.secretPrompt';

type SecretValuePromptResponse = {
  secretValue: string;
};

export function secretValuePrompt(): Promise<SecretValuePromptResponse> {
  return promptUser<SecretValuePromptResponse>([
    {
      name: 'secretValue',
      type: 'password',
      mask: '*',
      message: i18n(`${i18nKey}.enterValue`),
    },
  ]);
}

type SecretNamePromptResponse = {
  secretName: string;
};

export function secretNamePrompt(): Promise<SecretNamePromptResponse> {
  return promptUser<SecretNamePromptResponse>([
    {
      name: 'secretName',
      type: 'input',
      message: i18n(`${i18nKey}.enterName`),
    },
  ]);
}

type SecretListPromptResponse = {
  secretToModify: string;
};

export function secretListPrompt(
  secrets: string[],
  message: string
): Promise<SecretListPromptResponse> {
  return promptUser<SecretListPromptResponse>([
    {
      name: 'secretToModify',
      type: 'list',
      choices: secrets,
      message,
    },
  ]);
}

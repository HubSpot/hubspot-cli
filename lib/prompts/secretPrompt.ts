import { promptUser } from './promptUtils.js';
import { lib } from '../../lang/en.js';

type SecretValuePromptResponse = {
  secretValue: string;
};

export function secretValuePrompt(): Promise<SecretValuePromptResponse> {
  return promptUser<SecretValuePromptResponse>([
    {
      name: 'secretValue',
      type: 'password',
      mask: '*',
      message: lib.prompts.secretPrompt.enterValue,
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
      message: lib.prompts.secretPrompt.enterName,
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

import { promptUser } from './promptUtils';
import { i18n } from '../lang';

const i18nKey = 'lib.prompts.secretPrompt';

export function secretValuePrompt() {
  return promptUser([
    {
      name: 'secretValue',
      type: 'password',
      mask: '*',
      message: i18n(`${i18nKey}.enterValue`),
    },
  ]);
}

export function secretNamePrompt() {
  return promptUser([
    {
      name: 'secretName',
      type: 'input',
      message: i18n(`${i18nKey}.enterName`),
    },
  ]);
}

export function secretListPrompt(secrets: string, message: string) {
  return promptUser([
    {
      name: 'secretToModify',
      type: 'list',
      choices: secrets,
      message,
    },
  ]);
}

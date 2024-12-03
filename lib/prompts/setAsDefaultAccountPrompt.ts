import {
  updateDefaultAccount,
  getConfigDefaultAccount,
} from '@hubspot/local-dev-lib/config';
import { promptUser } from './promptUtils';
import { i18n } from '../lang';

const i18nKey = 'lib.prompts.setAsDefaultAccountPrompt';

export async function setAsDefaultAccountPrompt(
  accountName: string
): Promise<boolean> {
  // Accounts for deprecated and new config
  const defaultAccount = getConfigDefaultAccount();

  const { setAsDefault } = await promptUser([
    {
      name: 'setAsDefault',
      type: 'confirm',
      when: defaultAccount !== accountName,
      message: i18n(`${i18nKey}.setAsDefaultAccountMessage`),
    },
  ]);

  if (setAsDefault) {
    updateDefaultAccount(accountName);
  }
  return setAsDefault;
}

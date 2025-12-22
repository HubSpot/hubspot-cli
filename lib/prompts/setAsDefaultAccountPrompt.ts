import {
  setConfigAccountAsDefault,
  getConfigDefaultAccountIfExists,
  getAllConfigAccounts,
} from '@hubspot/local-dev-lib/config';
import { promptUser } from './promptUtils.js';
import { lib } from '../../lang/en.js';
import { uiLogger } from '../ui/logger.js';

export async function setAsDefaultAccountPrompt(
  accountName: string
): Promise<boolean> {
  // Accounts for deprecated and new config
  const defaultAccount = getConfigDefaultAccountIfExists();
  const accounts = getAllConfigAccounts() || [];

  const { setAsDefault } = await promptUser([
    {
      name: 'setAsDefault',
      type: 'confirm',
      when: accounts.length >= 1 && defaultAccount?.name !== accountName,
      message: lib.prompts.setAsDefaultAccountPrompt.setAsDefaultAccountMessage,
    },
  ]);

  uiLogger.log('');
  if (setAsDefault) {
    setConfigAccountAsDefault(accountName);

    uiLogger.success(
      lib.prompts.setAsDefaultAccountPrompt.setAsDefaultAccount(accountName)
    );
  } else if (defaultAccount) {
    uiLogger.log(
      lib.prompts.setAsDefaultAccountPrompt.keepingCurrentDefault(
        defaultAccount.name
      )
    );
  }

  return setAsDefault;
}

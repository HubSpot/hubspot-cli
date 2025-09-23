import {
  updateDefaultAccount,
  getConfigDefaultAccount,
} from '@hubspot/local-dev-lib/config';
import { promptUser } from './promptUtils.js';
import { i18n } from '../lang.js';
import { uiLogger } from '../ui/logger.js';

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
      message: i18n(
        `lib.prompts.setAsDefaultAccountPrompt.setAsDefaultAccountMessage`
      ),
    },
  ]);

  uiLogger.log('');
  if (setAsDefault) {
    updateDefaultAccount(accountName);

    uiLogger.success(
      i18n('lib.prompts.setAsDefaultAccountPrompt.setAsDefaultAccount', {
        accountName,
      })
    );
  } else {
    uiLogger.log(
      i18n('lib.prompts.setAsDefaultAccountPrompt.keepingCurrentDefault', {
        accountName: getConfigDefaultAccount()!,
      })
    );
  }

  return setAsDefault;
}

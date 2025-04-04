import { accountNameExistsInConfig } from '@hubspot/local-dev-lib/config';
import { promptUser } from './promptUtils';
import { i18n } from '../lang';
import { PromptConfig } from '../../types/Prompts';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import { AccountType } from '@hubspot/local-dev-lib/types/Accounts';


export type AccountNamePromptResponse = {
  name: string;
};

export function getCliAccountNamePromptConfig(
  defaultName?: string
): PromptConfig<AccountNamePromptResponse> {
  return {
    name: 'name',
    message: i18n(`lib.prompts.accountNamePrompt.enterAccountName`),
    default: defaultName,
    validate(val?: string) {
      if (typeof val !== 'string') {
        return i18n(`lib.prompts.accountNamePrompt.errors.invalidName`);
      } else if (!val.length) {
        return i18n(`lib.prompts.accountNamePrompt.errors.nameRequired`);
      } else if (val.indexOf(' ') >= 0) {
        return i18n(`lib.prompts.accountNamePrompt.errors.spacesInName`);
      }
      return accountNameExistsInConfig(val)
        ? i18n(`lib.prompts.accountNamePrompt.errors.accountNameExists`, { name: val })
        : true;
    },
  };
}

export function cliAccountNamePrompt(
  defaultName?: string
): Promise<AccountNamePromptResponse> {
  return promptUser<AccountNamePromptResponse>(
    getCliAccountNamePromptConfig(defaultName)
  );
}

export function hubspotAccountNamePrompt({
  accountType,
  currentPortalCount = 0,
}: {
  accountType: AccountType;
  currentPortalCount?: number;
}): Promise<AccountNamePromptResponse> {
  const isDevelopmentSandbox =
    accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX;
  const isSandbox =
    accountType === HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX ||
    isDevelopmentSandbox;
  const isDeveloperTestAccount =
    accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST;

  let promptMessageString: string | undefined;
  let defaultName: string | undefined;
  if (isSandbox) {
    promptMessageString = isDevelopmentSandbox
      ? i18n(`lib.prompts.accountNamePrompt.enterDevelopmentSandboxName`)
      : i18n(`lib.prompts.accountNamePrompt.enterStandardSandboxName`);
  } else if (isDeveloperTestAccount) {
    promptMessageString = i18n(`lib.prompts.accountNamePrompt.enterDeveloperTestAccountName`);
    defaultName = i18n(`lib.prompts.accountNamePrompt.developerTestAccountDefaultName`, {
      count: currentPortalCount + 1,
    });
  }

  return promptUser<AccountNamePromptResponse>([
    {
      name: 'name',
      message: promptMessageString,
      validate(val?: string) {
        if (typeof val !== 'string') {
          return i18n(`lib.prompts.accountNamePrompt.errors.invalidName`);
        } else if (!val.trim().length) {
          return i18n(`lib.prompts.accountNamePrompt.errors.nameRequired`);
        }
        return accountNameExistsInConfig(val)
          ? i18n(`lib.prompts.accountNamePrompt.errors.accountNameExists`, { name: val })
          : true;
      },
      default: defaultName,
    },
  ]);
}

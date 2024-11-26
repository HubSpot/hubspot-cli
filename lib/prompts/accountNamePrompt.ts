import { accountNameExistsInConfig } from '@hubspot/local-dev-lib/config';
import { promptUser } from './promptUtils';
import { i18n } from '../lang';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';

const i18nKey = 'lib.prompts.accountNamePrompt';

type AccountNamePromptConfig = {
  name: string;
  message: string;
  default: string;
  validate(val: string): string | boolean;
};

export function getCliAccountNamePromptConfig(
  defaultName: string
): AccountNamePromptConfig {
  return {
    name: 'name',
    message: i18n(`${i18nKey}.enterAccountName`),
    default: defaultName,
    validate(val: string): string | boolean {
      if (typeof val !== 'string') {
        return i18n(`${i18nKey}.errors.invalidName`);
      } else if (!val.length) {
        return i18n(`${i18nKey}.errors.nameRequired`);
      } else if (val.indexOf(' ') >= 0) {
        return i18n(`${i18nKey}.errors.spacesInName`);
      }
      return accountNameExistsInConfig(val)
        ? i18n(`${i18nKey}.errors.accountNameExists`, { name: val })
        : true;
    },
  };
}

export function cliAccountNamePrompt(
  defaultName: string
): AccountNamePromptConfig {
  return promptUser(getCliAccountNamePromptConfig(defaultName));
}

export function hubspotAccountNamePrompt({
  accountType,
  currentPortalCount = 0,
}: {
  accountType: keyof typeof HUBSPOT_ACCOUNT_TYPES;
  currentPortalCount?: number;
}): AccountNamePromptConfig {
  const isDevelopmentSandbox =
    accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX;
  const isSandbox =
    accountType === HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX ||
    isDevelopmentSandbox;
  const isDeveloperTestAccount =
    accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST;

  let promptMessageString;
  let defaultName;
  if (isSandbox) {
    promptMessageString = isDevelopmentSandbox
      ? i18n(`${i18nKey}.enterDevelopmentSandboxName`)
      : i18n(`${i18nKey}.enterStandardSandboxName`);
  } else if (isDeveloperTestAccount) {
    promptMessageString = i18n(`${i18nKey}.enterDeveloperTestAccountName`);
    defaultName = i18n(`${i18nKey}.developerTestAccountDefaultName`, {
      count: currentPortalCount + 1,
    });
  }

  return promptUser([
    {
      name: 'name',
      message: promptMessageString,
      validate(val: string): string | boolean {
        if (typeof val !== 'string') {
          return i18n(`${i18nKey}.errors.invalidName`);
        } else if (!val.trim().length) {
          return i18n(`${i18nKey}.errors.nameRequired`);
        }
        return accountNameExistsInConfig(val)
          ? i18n(`${i18nKey}.errors.accountNameExists`, { name: val })
          : true;
      },
      default: defaultName,
    },
  ]);
}

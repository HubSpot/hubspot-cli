import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import { CLIAccount, AccountType } from '@hubspot/local-dev-lib/types/Accounts';

function isAccountType(
  accountConfig: CLIAccount,
  accountType: AccountType
): boolean {
  return (
    Boolean(accountConfig.accountType) &&
    accountConfig.accountType === accountType
  );
}

export function isStandardAccount(accountConfig: CLIAccount): boolean {
  return isAccountType(accountConfig, HUBSPOT_ACCOUNT_TYPES.STANDARD);
}

export function isSandbox(accountConfig: CLIAccount): boolean {
  return (
    isAccountType(accountConfig, HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX) ||
    isAccountType(accountConfig, HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX)
  );
}

export function isStandardSandbox(accountConfig: CLIAccount): boolean {
  return isAccountType(accountConfig, HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX);
}

export function isDevelopmentSandbox(accountConfig: CLIAccount): boolean {
  return isAccountType(
    accountConfig,
    HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX
  );
}

export function isDeveloperTestAccount(accountConfig: CLIAccount): boolean {
  return isAccountType(accountConfig, HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST);
}

export function isAppDeveloperAccount(accountConfig: CLIAccount): boolean {
  return isAccountType(accountConfig, HUBSPOT_ACCOUNT_TYPES.APP_DEVELOPER);
}

import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import {
  HubSpotConfigAccount,
  AccountType,
} from '@hubspot/local-dev-lib/types/Accounts';

function isAccountType(
  account: HubSpotConfigAccount,
  accountType: AccountType
): boolean {
  return Boolean(account.accountType) && account.accountType === accountType;
}

export function isStandardAccount(account: HubSpotConfigAccount): boolean {
  return isAccountType(account, HUBSPOT_ACCOUNT_TYPES.STANDARD);
}

export function isSandbox(account: HubSpotConfigAccount): boolean {
  return (
    isAccountType(account, HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX) ||
    isAccountType(account, HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX)
  );
}

export function isStandardSandbox(account: HubSpotConfigAccount): boolean {
  return isAccountType(account, HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX);
}

export function isDevelopmentSandbox(account: HubSpotConfigAccount): boolean {
  return isAccountType(account, HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX);
}

export function isDeveloperTestAccount(account: HubSpotConfigAccount): boolean {
  return isAccountType(account, HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST);
}

export function isAppDeveloperAccount(account: HubSpotConfigAccount): boolean {
  return isAccountType(account, HUBSPOT_ACCOUNT_TYPES.APP_DEVELOPER);
}

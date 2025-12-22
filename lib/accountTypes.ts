import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import {
  HubSpotConfigAccount,
  AccountType,
} from '@hubspot/local-dev-lib/types/Accounts';
import { hasUnfiedAppsAccess } from './hasFeature.js';

function isAccountType(
  accountConfig: HubSpotConfigAccount,
  accountType: AccountType[]
): boolean {
  return Boolean(
    accountConfig.accountType && accountType.includes(accountConfig.accountType)
  );
}

export function isStandardAccount(
  accountConfig: HubSpotConfigAccount
): boolean {
  return isAccountType(accountConfig, [HUBSPOT_ACCOUNT_TYPES.STANDARD]);
}

export function isSandbox(accountConfig: HubSpotConfigAccount): boolean {
  return isAccountType(accountConfig, [
    HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
    HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
  ]);
}

export function isStandardSandbox(
  accountConfig: HubSpotConfigAccount
): boolean {
  return isAccountType(accountConfig, [HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX]);
}

export function isDevelopmentSandbox(
  accountConfig: HubSpotConfigAccount
): boolean {
  return isAccountType(accountConfig, [
    HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
  ]);
}

export function isDeveloperTestAccount(
  accountConfig: HubSpotConfigAccount
): boolean {
  return isAccountType(accountConfig, [HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST]);
}

export function isAppDeveloperAccount(
  accountConfig: HubSpotConfigAccount
): boolean {
  return isAccountType(accountConfig, [HUBSPOT_ACCOUNT_TYPES.APP_DEVELOPER]);
}

export function isTestAccountOrSandbox(
  accountConfig: HubSpotConfigAccount
): boolean {
  return isAccountType(accountConfig, [
    HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST,
    HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
    HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
  ]);
}

export async function isUnifiedAccount(
  account: HubSpotConfigAccount
): Promise<boolean> {
  if (!account.accountId) {
    return false;
  }

  return hasUnfiedAppsAccess(account.accountId);
}

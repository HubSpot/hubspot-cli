import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import { CLIAccount, AccountType } from '@hubspot/local-dev-lib/types/Accounts';
import { hasUnfiedAppsAccess } from './hasFeature.js';
import { getAccountIdentifier } from '@hubspot/local-dev-lib/config/getAccountIdentifier';

function isAccountType(
  accountConfig: CLIAccount,
  accountType: AccountType[]
): boolean {
  return Boolean(
    accountConfig.accountType && accountType.includes(accountConfig.accountType)
  );
}

export function isStandardAccount(accountConfig: CLIAccount): boolean {
  return isAccountType(accountConfig, [HUBSPOT_ACCOUNT_TYPES.STANDARD]);
}

export function isSandbox(accountConfig: CLIAccount): boolean {
  return isAccountType(accountConfig, [
    HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
    HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
  ]);
}

export function isStandardSandbox(accountConfig: CLIAccount): boolean {
  return isAccountType(accountConfig, [HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX]);
}

export function isDevelopmentSandbox(accountConfig: CLIAccount): boolean {
  return isAccountType(accountConfig, [
    HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
  ]);
}

export function isDeveloperTestAccount(accountConfig: CLIAccount): boolean {
  return isAccountType(accountConfig, [HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST]);
}

export function isAppDeveloperAccount(accountConfig: CLIAccount): boolean {
  return isAccountType(accountConfig, [HUBSPOT_ACCOUNT_TYPES.APP_DEVELOPER]);
}

export function isTestAccountOrSandbox(accountConfig: CLIAccount): boolean {
  return isAccountType(accountConfig, [
    HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST,
    HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
    HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
  ]);
}

export async function isUnifiedAccount(account: CLIAccount): Promise<boolean> {
  const accountId = getAccountIdentifier(account);
  if (!accountId) {
    return false;
  }

  return hasUnfiedAppsAccess(accountId);
}

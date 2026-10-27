import { getAllConfigAccounts } from '@hubspot/local-dev-lib/config';
import {
  API_KEY_AUTH_METHOD,
  OAUTH_AUTH_METHOD,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} from '@hubspot/local-dev-lib/constants/auth';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';

function getAccountCredentials(
  account: HubSpotConfigAccount
): Array<string | undefined> {
  if (account.authType === API_KEY_AUTH_METHOD.value) {
    return [account.apiKey];
  }

  const { accessToken, refreshToken } = account.auth?.tokenInfo ?? {};

  if (account.authType === PERSONAL_ACCESS_KEY_AUTH_METHOD.value) {
    return [account.personalAccessKey, accessToken, refreshToken];
  }

  if (account.authType === OAUTH_AUTH_METHOD.value) {
    return [account.auth.clientSecret, accessToken, refreshToken];
  }

  return [accessToken, refreshToken];
}

export function getConfigCredentials(): string[] {
  try {
    return getAllConfigAccounts()
      .flatMap(getAccountCredentials)
      .filter((credential): credential is string => Boolean(credential));
  } catch {
    return [];
  }
}

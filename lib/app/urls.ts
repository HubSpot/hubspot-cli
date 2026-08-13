import {
  getHubSpotWebsiteOrigin,
  getHubSpotWebsiteOriginByAccountId,
} from '@hubspot/local-dev-lib/urls';
import { Environment } from '@hubspot/local-dev-lib/types/Accounts';

type PrivateAppInstallUrlArgs = {
  targetAccountId: number;
  env: Environment;
  appId: number;
};

type PublicAppInstallUrlArgs = {
  targetAccountId: number;
  env: Environment;
  clientId: string;
  scopes: string[];
  redirectUrls: string[];
};

export function getOauthAppInstallUrl({
  targetAccountId,
  env,
  clientId,
  scopes,
  redirectUrls,
}: PublicAppInstallUrlArgs): string {
  const websiteOrigin = getHubSpotWebsiteOrigin(env);
  return (
    `${websiteOrigin}/oauth/${targetAccountId}/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&scope=${encodeURIComponent(scopes.join(' '))}` +
    `&redirect_uri=${encodeURIComponent(redirectUrls[0])}`
  );
}

export function getStaticAuthAppInstallUrl({
  targetAccountId,
  env,
  appId,
}: PrivateAppInstallUrlArgs): string {
  const websiteOrigin = getHubSpotWebsiteOrigin(env);
  return `${websiteOrigin}/static-token/${targetAccountId}/authorize?appId=${appId}`;
}

export function getAppCardSetupUrl({
  targetAccountId,
  env,
  appId,
}: PrivateAppInstallUrlArgs): string {
  const websiteOrigin = getHubSpotWebsiteOrigin(env);
  return `${websiteOrigin}/integrations-settings/${targetAccountId}/installed/framework/${appId}/app-cards?tourId=get-started`;
}

export function getAppLogsUrl(
  accountId: number,
  appId: number,
  systemType: string
): string {
  return `${getHubSpotWebsiteOriginByAccountId(accountId)}/developer-monitoring/${accountId}/?logType=${systemType}&appId=${appId}`;
}

export function getAppLogDetailsUrl(
  accountId: number,
  appId: number,
  systemType: string,
  logId: string
): string {
  return `${getAppLogsUrl(accountId, appId, systemType)}&logId=${logId}`;
}

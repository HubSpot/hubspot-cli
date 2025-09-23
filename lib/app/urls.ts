import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { Environment } from '@hubspot/local-dev-lib/types/Config';

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

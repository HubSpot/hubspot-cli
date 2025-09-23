import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { getEnv } from '@hubspot/local-dev-lib/config';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';

function getBaseUrl(accountId: number): string {
  return getHubSpotWebsiteOrigin(
    getEnv(accountId) === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
  );
}

function getProjectHomeUrl(accountId: number): string {
  return `${getBaseUrl(accountId)}/developer-projects/${accountId}`;
}

export function getProjectComponentDistributionUrl(
  projectName: string,
  componentName: string,
  accountId: number
): string {
  const baseUrl = getHubSpotWebsiteOrigin(
    getEnv(accountId) === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
  );
  return `${baseUrl}/developer-projects/${accountId}/project/${projectName}/component/${componentName}/distribution`;
}

export function getDeveloperOverviewUrl(accountId: number): string {
  const baseUrl = getHubSpotWebsiteOrigin(
    getEnv(accountId) === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
  );
  return `${baseUrl}/developer-overview/${accountId}`;
}

export function getProjectDetailUrl(
  projectName: string,
  accountId: number
): string | undefined {
  if (!projectName) return;
  return `${getProjectHomeUrl(accountId)}/project/${projectName}`;
}

export function getProjectSettingsUrl(
  projectName: string,
  accountId: number
): string | undefined {
  if (!projectName) return;
  return `${getProjectDetailUrl(projectName, accountId)}/settings`;
}

export function getProjectActivityUrl(
  projectName: string,
  accountId: number
): string {
  return `${getProjectDetailUrl(projectName, accountId)}/activity`;
}

export function getProjectBuildDetailUrl(
  projectName: string,
  buildId: number,
  accountId: number
): string {
  return `${getProjectActivityUrl(projectName, accountId)}/build/${buildId}`;
}

export function getProjectDeployDetailUrl(
  projectName: string,
  deployId: number,
  accountId: number
): string {
  return `${getProjectActivityUrl(projectName, accountId)}/deploy/${deployId}`;
}

export function getLocalDevUiUrl(
  accountId: number,
  showWelcomeScreen?: boolean
): string {
  return `${getBaseUrl(accountId)}/developer-projects-local-dev/${accountId}${showWelcomeScreen ? '?welcome' : ''}`;
}

export function getAccountHomeUrl(accountId: number): string {
  const baseUrl = getHubSpotWebsiteOrigin(
    getEnv(accountId) === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
  );
  return `${baseUrl}/home?portalId=${accountId}`;
}

export function getAppAllowlistUrl(
  accountId: number,
  projectName: string,
  appUid: string
): string {
  return `${getProjectHomeUrl(accountId)}/project/${projectName}/component/${appUid}/distribution?panel=static-token-allowlist`;
}

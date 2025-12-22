import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { getConfigAccountEnvironment } from '@hubspot/local-dev-lib/config';

function getBaseUrl(accountId: number): string {
  return getHubSpotWebsiteOrigin(getConfigAccountEnvironment(accountId));
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
    getConfigAccountEnvironment(accountId)
  );
  return `${baseUrl}/developer-projects/${accountId}/project/${projectName}/component/${componentName}/distribution`;
}

export function getDeveloperOverviewUrl(accountId: number): string {
  const baseUrl = getHubSpotWebsiteOrigin(
    getConfigAccountEnvironment(accountId)
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
    getConfigAccountEnvironment(accountId)
  );
  return `${baseUrl}/home?portalId=${accountId}`;
}

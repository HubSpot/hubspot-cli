import { getHubSpotWebsiteOriginByAccountId } from '@hubspot/local-dev-lib/urls';

function getProjectHomeUrl(accountId: number): string {
  return `${getHubSpotWebsiteOriginByAccountId(accountId)}/developer-projects/${accountId}`;
}

export function getProjectComponentDistributionUrl(
  projectName: string,
  componentName: string,
  accountId: number
): string {
  return `${getHubSpotWebsiteOriginByAccountId(accountId)}/developer-projects/${accountId}/project/${projectName}/component/${componentName}/distribution`;
}

export function getDeveloperOverviewUrl(accountId: number): string {
  return `${getHubSpotWebsiteOriginByAccountId(accountId)}/developer-overview/${accountId}`;
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
  return `${getHubSpotWebsiteOriginByAccountId(accountId)}/developer-projects-local-dev/${accountId}${showWelcomeScreen ? '?welcome' : ''}`;
}

export function getAccountHomeUrl(accountId: number): string {
  return `${getHubSpotWebsiteOriginByAccountId(accountId)}/home?portalId=${accountId}`;
}

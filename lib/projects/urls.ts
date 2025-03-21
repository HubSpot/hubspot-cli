import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { getConfigAccountById } from '@hubspot/local-dev-lib/config';

function getProjectHomeUrl(accountId: number): string {
  const account = getConfigAccountById(accountId);
  const baseUrl = getHubSpotWebsiteOrigin(account.env);

  return `${baseUrl}/developer-projects/${accountId}`;
}

export function getProjectDetailUrl(
  projectName: string,
  accountId: number
): string | undefined {
  if (!projectName) return;
  return `${getProjectHomeUrl(accountId)}/project/${projectName}`;
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

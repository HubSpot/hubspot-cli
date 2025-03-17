import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { getEnv } from '@hubspot/local-dev-lib/config';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';

function getProjectHomeUrl(accountId: number): string {
  const baseUrl = getHubSpotWebsiteOrigin(
    getEnv(accountId) === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
  );

  return `${baseUrl}/developer-projects/${accountId}`;
}

export function getProjectDetailUrl(
  projectName: string,
  accountId: number,
  v2: boolean = false
): string | undefined {
  if (!projectName) return;
  return v2
    ? `${getProjectHomeUrl(accountId)}/${projectName}`
    : `${getProjectHomeUrl(accountId)}/project/${projectName}`;
}

export function getProjectActivityUrl(
  projectName: string,
  accountId: number,
  v2: boolean = false
): string {
  return `${getProjectDetailUrl(projectName, accountId, v2)}/activity`;
}

export function getProjectBuildDetailUrl(
  projectName: string,
  buildId: number,
  accountId: number,
  v2: boolean = false
): string {
  return v2
    ? `${getProjectActivityUrl(projectName, accountId, v2)}/activity/build/${buildId}`
    : `${getProjectActivityUrl(projectName, accountId)}/build/${buildId}`;
}

export function getProjectDeployDetailUrl(
  projectName: string,
  deployId: number,
  accountId: number,
  v2: boolean = false
): string {
  return v2
    ? `${getProjectActivityUrl(projectName, accountId, v2)}/activity/deploy/${deployId}`
    : `${getProjectActivityUrl(projectName, accountId)}/deploy/${deployId}`;
}

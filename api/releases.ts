import { SUBBUILD_TYPES } from '@hubspot/local-dev-lib/enums/build';
import { http } from '@hubspot/local-dev-lib/http';
import { HubSpotPromise, QueryParams } from '@hubspot/local-dev-lib/types/Http';
import { ValueOf } from '@hubspot/local-dev-lib/types/Utils';

const PROJECTS_API_PATH = 'dfs/v1/projects';
const PROJECTS_DEPLOY_API_PATH = 'dfs/deploy/v1';

export type Release = {
  releaseTag: string;
  buildId: number;
  createdAt: string;
  components?: Array<{
    buildType: ValueOf<typeof SUBBUILD_TYPES>;
    buildName?: string;
    rootPath?: string;
    id?: string;
  }>;
};

export type FetchListReleasesResponse = {
  results: Array<Release>;
  paging: {
    next: {
      after: string;
    };
  };
};

export type AutoReleaseResponse = {
  releaseTag: string;
  status: string;
  appId: number;
};

export type AutoReleaseStatusResponse = {
  status: 'PENDING' | 'COMPLETE';
  currentReleaseTag?: string;
};

export function createRelease(
  accountId: number,
  projectName: string,
  buildId: number
): HubSpotPromise<Release> {
  return http.post<Release>(accountId, {
    url: `${PROJECTS_API_PATH}/${encodeURIComponent(projectName)}/releases`,
    data: { buildId },
  });
}

export function listReleases(
  accountId: number,
  projectName: string,
  params: QueryParams = {}
): HubSpotPromise<FetchListReleasesResponse> {
  return http.get<FetchListReleasesResponse>(accountId, {
    url: `${PROJECTS_API_PATH}/${encodeURIComponent(projectName)}/releases`,
    params,
  });
}

export function getReleaseInfo(
  accountId: number,
  projectName: string,
  releaseTag: string
): HubSpotPromise<Release> {
  return http.get<Release>(accountId, {
    url: `${PROJECTS_API_PATH}/${encodeURIComponent(projectName)}/releases/${encodeURIComponent(releaseTag)}`,
  });
}

export function triggerAutoRelease(
  accountId: number,
  projectId: number,
  buildId: number,
  targetPortalId: number
): HubSpotPromise<AutoReleaseResponse> {
  return http.post<AutoReleaseResponse>(accountId, {
    url: `${PROJECTS_DEPLOY_API_PATH}/auto-release`,
    data: {
      projectId,
      buildId,
      targetPortalId,
    },
  });
}

export function getAutoReleaseStatus(
  accountId: number,
  projectId: number,
  targetPortalId: number,
  expectedReleaseTag: string,
  appId: number
): HubSpotPromise<AutoReleaseStatusResponse> {
  return http.get<AutoReleaseStatusResponse>(accountId, {
    url: `${PROJECTS_DEPLOY_API_PATH}/auto-release/status`,
    params: {
      projectId,
      targetPortalId,
      expectedReleaseTag,
      appId,
    },
  });
}

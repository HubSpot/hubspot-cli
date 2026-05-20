import { http } from '@hubspot/local-dev-lib/http';
import { Mock } from 'vitest';

import {
  createRelease,
  listReleases,
  getReleaseInfo,
  triggerAutoRelease,
  getAutoReleaseStatus,
} from '../releases.js';

vi.mock('@hubspot/local-dev-lib/http');

const mockedHttpGet = http.get as Mock;
const mockedHttpPost = http.post as Mock;

const accountId = 123;
const projectName = 'my-project';
const projectNameIllegalChars = 'my project/name';

describe('api/releases', () => {
  describe('createRelease', () => {
    const buildId = 12345;

    it('should call http correctly', async () => {
      await createRelease(accountId, projectName, buildId);

      expect(mockedHttpPost).toHaveBeenCalledTimes(1);
      expect(mockedHttpPost).toHaveBeenCalledWith(accountId, {
        url: `dfs/v1/projects/${projectName}/releases`,
        data: { buildId },
      });
    });

    it('should encode the project name', async () => {
      await createRelease(accountId, projectNameIllegalChars, buildId);

      expect(mockedHttpPost).toHaveBeenCalledWith(accountId, {
        url: `dfs/v1/projects/${encodeURIComponent(projectNameIllegalChars)}/releases`,
        data: { buildId },
      });
    });
  });

  describe('listReleases', () => {
    it('should call http correctly', async () => {
      const params = { limit: 10, after: 'abc' };
      await listReleases(accountId, projectName, params);

      expect(mockedHttpGet).toHaveBeenCalledTimes(1);
      expect(mockedHttpGet).toHaveBeenCalledWith(accountId, {
        url: `dfs/v1/projects/${projectName}/releases`,
        params,
      });
    });

    it('should default params to empty object', async () => {
      await listReleases(accountId, projectName);

      expect(mockedHttpGet).toHaveBeenCalledWith(accountId, {
        url: `dfs/v1/projects/${projectName}/releases`,
        params: {},
      });
    });

    it('should encode the project name', async () => {
      await listReleases(accountId, projectNameIllegalChars);

      expect(mockedHttpGet).toHaveBeenCalledWith(accountId, {
        url: `dfs/v1/projects/${encodeURIComponent(projectNameIllegalChars)}/releases`,
        params: {},
      });
    });
  });

  describe('getReleaseInfo', () => {
    const releaseTag = 'v1.0.0';

    it('should call http correctly', async () => {
      await getReleaseInfo(accountId, projectName, releaseTag);

      expect(mockedHttpGet).toHaveBeenCalledTimes(1);
      expect(mockedHttpGet).toHaveBeenCalledWith(accountId, {
        url: `dfs/v1/projects/${projectName}/releases/${encodeURIComponent(releaseTag)}`,
      });
    });

    it('should encode the project name', async () => {
      await getReleaseInfo(accountId, projectNameIllegalChars, releaseTag);

      expect(mockedHttpGet).toHaveBeenCalledWith(accountId, {
        url: `dfs/v1/projects/${encodeURIComponent(projectNameIllegalChars)}/releases/${encodeURIComponent(releaseTag)}`,
      });
    });
  });

  describe('triggerAutoRelease', () => {
    const projectId = 1;
    const buildId = 100;
    const targetPortalId = 456;

    it('should call http correctly', async () => {
      await triggerAutoRelease(accountId, projectId, buildId, targetPortalId);

      expect(mockedHttpPost).toHaveBeenCalledTimes(1);
      expect(mockedHttpPost).toHaveBeenCalledWith(accountId, {
        url: 'dfs/deploy/v1/auto-release',
        data: {
          projectId,
          buildId,
          targetPortalId,
        },
      });
    });
  });

  describe('getAutoReleaseStatus', () => {
    const projectId = 1;
    const targetPortalId = 456;
    const expectedReleaseTag = 'v1.0.0';
    const appId = 789;

    it('should call http correctly', async () => {
      await getAutoReleaseStatus(
        accountId,
        projectId,
        targetPortalId,
        expectedReleaseTag,
        appId
      );

      expect(mockedHttpGet).toHaveBeenCalledTimes(1);
      expect(mockedHttpGet).toHaveBeenCalledWith(accountId, {
        url: 'dfs/deploy/v1/auto-release/status',
        params: {
          projectId,
          targetPortalId,
          expectedReleaseTag,
          appId,
        },
      });
    });
  });
});

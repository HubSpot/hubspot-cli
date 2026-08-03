import { HttpStatusCode } from 'axios';
import {
  Build,
  FetchProjectBuildsResponse,
} from '@hubspot/local-dev-lib/types/Build';
import * as projectApiUtils from '@hubspot/local-dev-lib/api/projects';
import * as releaseApiUtils from '../../../api/releases.js';
import * as promptUtils from '../../prompts/promptUtils.js';
import { uiLogger } from '../../ui/logger.js';
import { PromptExitError } from '../../errors/PromptExitError.js';
import { EXIT_CODES } from '../../enums/exitCodes.js';
import {
  mockHubSpotHttpResponse,
  mockHubSpotHttpError,
} from '../../testUtils.js';
import { Release } from '../../../api/releases.js';
import {
  resolveBuildId,
  validateBuildForRelease,
  executeRelease,
} from '../release.js';
import { PLATFORM_VERSIONS } from '@hubspot/project-parsing-lib/constants';
import { expect } from 'vitest';

vi.mock('@hubspot/local-dev-lib/api/projects');
vi.mock('../../prompts/promptUtils');
vi.mock('../../../api/releases.js');

const exampleSuccessfulBuild = {
  buildId: 8,
  status: 'SUCCESS',
  uploadMessage: 'My upload message',
} as Build;

const exampleOlderSuccessfulBuild = {
  buildId: 6,
  status: 'SUCCESS',
  uploadMessage: '',
} as Build;

const exampleFailedBuild = {
  buildId: 7,
  status: 'FAILURE',
  uploadMessage: '',
} as Build;

const exampleBuildsResponse: FetchProjectBuildsResponse = {
  results: [exampleSuccessfulBuild, exampleOlderSuccessfulBuild],
  paging: { next: { after: '', link: '' } },
};

const exampleMixedBuildsResponse: FetchProjectBuildsResponse = {
  results: [exampleSuccessfulBuild, exampleFailedBuild],
  paging: { next: { after: '', link: '' } },
};

const exampleRelease: Release = {
  releaseTag: 'v1.0.0',
  buildId: 8,
  createdAt: '2026-02-23T12:00:00.000Z',
};

const accountId = 1234567890;
const projectName = 'my-project';

const fetchProjectBuildsSpy = vi.spyOn(projectApiUtils, 'fetchProjectBuilds');
const getBuildStatusSpy = vi.spyOn(projectApiUtils, 'getBuildStatus');
const createReleaseSpy = vi.spyOn(releaseApiUtils, 'createRelease');
const listPromptSpy = vi.spyOn(promptUtils, 'listPrompt');

describe('lib/projects/release', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchProjectBuildsSpy.mockReturnValue(
      mockHubSpotHttpResponse<FetchProjectBuildsResponse>(exampleBuildsResponse)
    );
    getBuildStatusSpy.mockReturnValue(
      mockHubSpotHttpResponse({} as Record<string, never>)
    );
    createReleaseSpy.mockReturnValue(
      mockHubSpotHttpResponse<Release>(exampleRelease)
    );
    listPromptSpy.mockResolvedValue(exampleSuccessfulBuild.buildId);
  });

  describe('resolveBuildId()', () => {
    it('returns buildOption immediately without fetching builds', async () => {
      const result = await resolveBuildId(accountId, projectName, 42);
      expect(fetchProjectBuildsSpy).not.toHaveBeenCalled();
      expect(result).toBe(42);
    });

    it('fetches project builds when no buildOption is provided', async () => {
      await resolveBuildId(accountId, projectName);
      expect(fetchProjectBuildsSpy).toHaveBeenCalledWith(
        accountId,
        projectName
      );
    });

    it('returns undefined on any HTTP error from fetchProjectBuilds', async () => {
      fetchProjectBuildsSpy.mockImplementation(() => {
        throw mockHubSpotHttpError('Not Found', {
          status: HttpStatusCode.NotFound,
          data: {},
        });
      });
      const result = await resolveBuildId(accountId, projectName);
      expect(result).toBeUndefined();
    });

    it('returns undefined on a 400 from fetchProjectBuilds', async () => {
      fetchProjectBuildsSpy.mockImplementation(() => {
        throw mockHubSpotHttpError(
          'Project `bbb` does not exist. Check your Hubspot UI or create a new project.',
          { status: HttpStatusCode.BadRequest, data: {} }
        );
      });
      const result = await resolveBuildId(accountId, projectName);
      expect(result).toBeUndefined();
    });

    it('rethrows non-404/400 HTTP errors from fetchProjectBuilds', async () => {
      fetchProjectBuildsSpy.mockImplementation(() => {
        throw mockHubSpotHttpError('Forbidden', {
          status: HttpStatusCode.Forbidden,
          data: {},
        });
      });
      await expect(resolveBuildId(accountId, projectName)).rejects.toThrow();
    });

    it('returns null and logs an error when builds exist but none are successful', async () => {
      fetchProjectBuildsSpy.mockReturnValue(
        mockHubSpotHttpResponse<FetchProjectBuildsResponse>({
          results: [exampleFailedBuild],
          paging: { next: { after: '', link: '' } },
        })
      );
      const result = await resolveBuildId(accountId, projectName);
      expect(result).toBeNull();
      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('No successful builds found')
      );
    });

    it('returns undefined and does not log an error when there are no builds at all', async () => {
      fetchProjectBuildsSpy.mockReturnValue(
        mockHubSpotHttpResponse<FetchProjectBuildsResponse>({
          results: [],
          paging: { next: { after: '', link: '' } },
        })
      );
      const result = await resolveBuildId(accountId, projectName);
      expect(result).toBeUndefined();
      expect(uiLogger.error).not.toHaveBeenCalled();
    });

    it('shows picker when successful builds exist on a later page', async () => {
      const failedPageResponse =
        mockHubSpotHttpResponse<FetchProjectBuildsResponse>({
          results: [exampleFailedBuild],
          paging: { next: { after: 'page2', link: '' } },
        });
      const successPageResponse =
        mockHubSpotHttpResponse<FetchProjectBuildsResponse>({
          results: [exampleSuccessfulBuild],
          paging: { next: { after: '', link: '' } },
        });
      fetchProjectBuildsSpy
        .mockReturnValueOnce(failedPageResponse)
        .mockReturnValueOnce(failedPageResponse)
        .mockReturnValueOnce(successPageResponse);

      const result = await resolveBuildId(accountId, projectName);

      expect(uiLogger.error).not.toHaveBeenCalled();
      expect(listPromptSpy).toHaveBeenCalled();
      expect(result).toBe(exampleSuccessfulBuild.buildId);
    });

    it('returns the most recent successful build when force=true', async () => {
      const result = await resolveBuildId(
        accountId,
        projectName,
        undefined,
        true
      );
      expect(listPromptSpy).not.toHaveBeenCalled();
      expect(result).toBe(exampleSuccessfulBuild.buildId);
    });

    it('shows all builds in list with non-successful ones disabled', async () => {
      fetchProjectBuildsSpy.mockReturnValue(
        mockHubSpotHttpResponse<FetchProjectBuildsResponse>(
          exampleMixedBuildsResponse
        )
      );
      await resolveBuildId(accountId, projectName);
      expect(listPromptSpy).toHaveBeenCalledWith(
        expect.stringContaining('[--build]'),
        expect.objectContaining({
          choices: expect.arrayContaining([
            expect.objectContaining({
              value: exampleSuccessfulBuild.buildId,
              disabled: undefined,
            }),
            expect.objectContaining({
              value: exampleFailedBuild.buildId,
              disabled: '– Build failed',
            }),
          ]),
        })
      );
    });

    it('includes upload message in build name when set', async () => {
      await resolveBuildId(accountId, projectName);
      expect(listPromptSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          choices: expect.arrayContaining([
            expect.objectContaining({
              name: `${exampleSuccessfulBuild.buildId} — ${exampleSuccessfulBuild.uploadMessage}`,
            }),
            expect.objectContaining({
              name: `${exampleOlderSuccessfulBuild.buildId} — No upload message`,
            }),
          ]),
        })
      );
    });

    it('falls back to raw status string for unmapped non-successful statuses', async () => {
      const unknownStatusBuild = {
        buildId: 5,
        status: 'UNKNOWN_STATUS',
        uploadMessage: '',
      } as unknown as Build;
      fetchProjectBuildsSpy.mockReturnValue(
        mockHubSpotHttpResponse<FetchProjectBuildsResponse>({
          results: [exampleSuccessfulBuild, unknownStatusBuild],
          paging: { next: { after: '', link: '' } },
        })
      );
      await resolveBuildId(accountId, projectName);
      expect(listPromptSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          choices: expect.arrayContaining([
            expect.objectContaining({
              value: unknownStatusBuild.buildId,
              disabled: '– UNKNOWN_STATUS',
            }),
          ]),
        })
      );
    });

    it('prefixes disabled build names with [DISABLED]', async () => {
      fetchProjectBuildsSpy.mockReturnValue(
        mockHubSpotHttpResponse<FetchProjectBuildsResponse>(
          exampleMixedBuildsResponse
        )
      );
      await resolveBuildId(accountId, projectName);
      expect(listPromptSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          choices: expect.arrayContaining([
            expect.objectContaining({
              value: exampleSuccessfulBuild.buildId,
              name: expect.not.stringContaining('DISABLED'),
            }),
            expect.objectContaining({
              value: exampleFailedBuild.buildId,
              name: expect.stringContaining('DISABLED'),
            }),
          ]),
        })
      );
    });

    it('propagates PromptExitError from listPrompt', async () => {
      listPromptSpy.mockRejectedValue(
        new PromptExitError('User exited', EXIT_CODES.SUCCESS)
      );
      await expect(resolveBuildId(accountId, projectName)).rejects.toThrow(
        PromptExitError
      );
    });
  });

  describe('validateBuildForRelease()', () => {
    it('returns true when the build meets the minimum platform version', async () => {
      getBuildStatusSpy.mockReturnValue(
        mockHubSpotHttpResponse({
          buildId: 8,
          platformVersion: PLATFORM_VERSIONS.v2026_09_BETA,
        })
      );
      const result = await validateBuildForRelease(accountId, projectName, 8);
      expect(result).toBe(true);
    });

    it('returns false when the build does not meet the minimum platform version', async () => {
      getBuildStatusSpy.mockReturnValue(
        mockHubSpotHttpResponse({
          buildId: 8,
          platformVersion: PLATFORM_VERSIONS.v2026_03,
        })
      );
      const result = await validateBuildForRelease(accountId, projectName, 8);
      expect(result).toBe(false);
    });

    it('shows build not found error when getBuildStatus returns 404', async () => {
      getBuildStatusSpy.mockImplementation(() => {
        throw mockHubSpotHttpError('Not Found', {
          status: HttpStatusCode.NotFound,
          data: {},
        });
      });
      await expect(
        validateBuildForRelease(accountId, projectName, 999)
      ).rejects.toThrow();
      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('999')
      );
      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('was not found')
      );
    });

    it('uses logError for non-404 getBuildStatus errors', async () => {
      getBuildStatusSpy.mockImplementation(() => {
        throw mockHubSpotHttpError('Server Error', {
          status: HttpStatusCode.InternalServerError,
          data: {},
        });
      });
      await expect(
        validateBuildForRelease(accountId, projectName, 5)
      ).rejects.toThrow();
      expect(uiLogger.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('executeRelease()', () => {
    it('returns the release on success', async () => {
      const result = await executeRelease(accountId, projectName, 8);
      expect(result).toEqual(exampleRelease);
    });

    it('throws on API error', async () => {
      createReleaseSpy.mockImplementation(() => {
        throw mockHubSpotHttpError('Server Error', {
          status: HttpStatusCode.InternalServerError,
          data: {},
        });
      });
      await expect(executeRelease(accountId, projectName, 8)).rejects.toThrow();
      expect(uiLogger.error).toHaveBeenCalledTimes(1);
    });
  });
});

import { HttpStatusCode } from 'axios';
import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import * as releaseApiUtils from '../../../../api/releases.js';
import { FetchListReleasesResponse } from '../../../../api/releases.js';
import {
  addAccountOptions,
  addConfigOptions,
  addJSONOutputOptions,
  addUseEnvironmentOptions,
} from '../../../../lib/commonOpts.js';
import * as projectUtils from '../../../../lib/projects/config.js';
import { EXIT_CODES } from '../../../../lib/enums/exitCodes.js';
import {
  mockHubSpotHttpResponse,
  mockHubSpotHttpError,
} from '../../../../lib/testUtils.js';
import projectReleaseListCommand, { ProjectReleaseListArgs } from '../list.js';
import { uiLogger } from '../../../../lib/ui/logger.js';

vi.mock('../../../../api/releases');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../../../lib/commonOpts');
vi.mock('../../../../lib/validation');
vi.mock('../../../../lib/projects/config');
vi.mock('../../../../lib/prompts/promptUtils');
vi.mock('../../../../ui/render.js');

const getProjectConfigSpy = vi.spyOn(projectUtils, 'getProjectConfig');
const validateProjectConfigSpy = vi.spyOn(
  projectUtils,
  'validateProjectConfig'
);
const listReleasesSpy = vi.spyOn(releaseApiUtils, 'listReleases');
const processExitSpy = vi.spyOn(process, 'exit');

const optionsSpy = vi
  .spyOn(yargs as Argv, 'options')
  .mockReturnValue(yargs as Argv);

const exampleSpy = vi
  .spyOn(yargs as Argv, 'example')
  .mockReturnValue(yargs as Argv);

const releasesResponse: FetchListReleasesResponse = {
  results: [
    {
      releaseTag: 'v1.1.0',
      buildId: 2,
      createdAt: '2026-02-20T15:30:00.000Z',
    },
    {
      releaseTag: 'v1.0.0',
      buildId: 1,
      createdAt: '2026-02-15T10:00:00.000Z',
    },
  ],
  paging: { next: { after: '' } },
};

const emptyReleasesResponse: FetchListReleasesResponse = {
  results: [],
  paging: { next: { after: '' } },
};

describe('commands/project/release/list', () => {
  let args: ArgumentsCamelCase<ProjectReleaseListArgs>;

  beforeEach(() => {
    vi.clearAllMocks();
    args = {
      derivedAccountId: 1234567890,
    } as ArgumentsCamelCase<ProjectReleaseListArgs>;

    getProjectConfigSpy.mockResolvedValue({
      projectConfig: {
        name: 'my-project',
        srcDir: 'src',
        platformVersion: '2025.2',
      },
      projectDir: '/path/to/project',
    });
    validateProjectConfigSpy.mockImplementation(() => {});
    listReleasesSpy.mockReturnValue(
      mockHubSpotHttpResponse<FetchListReleasesResponse>(releasesResponse)
    );
    // @ts-expect-error Mock implementation
    processExitSpy.mockImplementation(() => {});
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectReleaseListCommand.command).toEqual('list');
    });
  });

  describe('describe', () => {
    it('should be hidden', () => {
      expect(projectReleaseListCommand.describe).toBeUndefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      projectReleaseListCommand.builder(yargs as Argv);

      expect(optionsSpy).toHaveBeenCalledTimes(1);
      expect(optionsSpy).toHaveBeenCalledWith({
        limit: expect.objectContaining({
          type: 'number',
        }),
      });

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addJSONOutputOptions).toHaveBeenCalledTimes(1);
    });

    it('should provide examples', () => {
      projectReleaseListCommand.builder(yargs as Argv);
      expect(exampleSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('handler', () => {
    it('should validate the project config', async () => {
      await projectReleaseListCommand.handler(args);
      expect(getProjectConfigSpy).toHaveBeenCalledTimes(1);
      expect(validateProjectConfigSpy).toHaveBeenCalledTimes(1);
    });

    it('should exit with error if project config is invalid', async () => {
      validateProjectConfigSpy.mockImplementation(() => {
        throw new Error('No project config found');
      });

      await projectReleaseListCommand.handler(args);

      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should call listReleases with the project name', async () => {
      await projectReleaseListCommand.handler(args);
      expect(listReleasesSpy).toHaveBeenCalledTimes(1);
      expect(listReleasesSpy).toHaveBeenCalledWith(
        args.derivedAccountId,
        'my-project',
        { limit: undefined }
      );
    });

    it('should pass limit option to listReleases', async () => {
      args.limit = 5;
      await projectReleaseListCommand.handler(args);
      expect(listReleasesSpy).toHaveBeenCalledWith(
        args.derivedAccountId,
        'my-project',
        { limit: 5 }
      );
    });

    it('should display no releases message when results are empty', async () => {
      listReleasesSpy.mockReturnValue(
        mockHubSpotHttpResponse<FetchListReleasesResponse>(
          emptyReleasesResponse
        )
      );

      await projectReleaseListCommand.handler(args);

      expect(uiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('No releases found')
      );
    });

    it('should output json when --json is provided', async () => {
      args.json = true;
      await projectReleaseListCommand.handler(args);
      expect(uiLogger.json).toHaveBeenCalledTimes(1);
      expect(uiLogger.json).toHaveBeenCalledWith({
        results: releasesResponse.results.map(r => ({
          releaseTag: r.releaseTag,
          buildId: r.buildId,
          createdAt: r.createdAt,
          components: undefined,
        })),
        paging: releasesResponse.paging,
      });
    });

    it('should handle 404 error from API', async () => {
      processExitSpy.mockImplementation((code?: string | number | null) => {
        throw new Error(`process.exit called with ${code}`);
      });
      listReleasesSpy.mockImplementation(() => {
        throw mockHubSpotHttpError('Not Found', {
          status: HttpStatusCode.NotFound,
          data: {},
        });
      });

      await expect(projectReleaseListCommand.handler(args)).rejects.toThrow();

      expect(uiLogger.error).toHaveBeenCalledTimes(1);
      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('does not exist')
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should handle unexpected errors', async () => {
      listReleasesSpy.mockImplementation(() => {
        throw mockHubSpotHttpError('Server Error', {
          status: HttpStatusCode.InternalServerError,
          data: {},
        });
      });

      await projectReleaseListCommand.handler(args);

      expect(uiLogger.error).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });
});

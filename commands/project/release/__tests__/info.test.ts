import { HttpStatusCode } from 'axios';
import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import * as releaseApiUtils from '../../../../api/releases.js';
import {
  Release,
  FetchListReleasesResponse,
} from '../../../../api/releases.js';
import {
  addAccountOptions,
  addConfigOptions,
  addJSONOutputOptions,
  addUseEnvironmentOptions,
} from '../../../../lib/commonOpts.js';
import * as projectUtils from '../../../../lib/projects/config.js';
import * as promptUtils from '../../../../lib/prompts/promptUtils.js';
import { EXIT_CODES } from '../../../../lib/enums/exitCodes.js';
import {
  mockHubSpotHttpResponse,
  mockHubSpotHttpError,
} from '../../../../lib/testUtils.js';
import projectReleaseInfoCommand, { ProjectReleaseInfoArgs } from '../info.js';
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
const getReleaseInfoSpy = vi.spyOn(releaseApiUtils, 'getReleaseInfo');
const listReleasesSpy = vi.spyOn(releaseApiUtils, 'listReleases');
const listPromptSpy = vi.spyOn(promptUtils, 'listPrompt');
const processExitSpy = vi.spyOn(process, 'exit');

const optionsSpy = vi
  .spyOn(yargs as Argv, 'options')
  .mockReturnValue(yargs as Argv);

const exampleSpy = vi
  .spyOn(yargs as Argv, 'example')
  .mockReturnValue(yargs as Argv);

const releaseResponse: Release = {
  releaseTag: 'v1.0.0',
  buildId: 12345,
  createdAt: '2026-02-15T10:00:00.000Z',
  components: [
    {
      buildType: 'APP',
      buildName: 'myFunc',
      rootPath: 'app/functions/myFunc.js',
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    },
    {
      buildType: 'PRIVATE_APP',
      buildName: 'myCard',
      rootPath: 'app/cards/myCard.json',
      id: 'e5f6g7h8-i9j0-1234-klmn-opqrstuvwxyz',
    },
  ],
};

const releaseWithNoComponents: Release = {
  releaseTag: 'v1.0.0',
  buildId: 12345,
  createdAt: '2026-02-15T10:00:00.000Z',
};

const releasesListResponse: FetchListReleasesResponse = {
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

describe('commands/project/release/info', () => {
  let args: ArgumentsCamelCase<ProjectReleaseInfoArgs>;

  beforeEach(() => {
    vi.clearAllMocks();
    args = {
      derivedAccountId: 1234567890,
      tag: 'v1.0.0',
    } as ArgumentsCamelCase<ProjectReleaseInfoArgs>;

    getProjectConfigSpy.mockResolvedValue({
      projectConfig: {
        name: 'my-project',
        srcDir: 'src',
        platformVersion: '2025.2',
      },
      projectDir: '/path/to/project',
    });
    validateProjectConfigSpy.mockImplementation(() => {});
    getReleaseInfoSpy.mockReturnValue(
      mockHubSpotHttpResponse<Release>(releaseResponse)
    );
    // @ts-expect-error Mock implementation
    processExitSpy.mockImplementation(() => {});
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectReleaseInfoCommand.command).toEqual('info');
    });
  });

  describe('describe', () => {
    it('should be hidden', () => {
      expect(projectReleaseInfoCommand.describe).toBeUndefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      projectReleaseInfoCommand.builder(yargs as Argv);

      expect(optionsSpy).toHaveBeenCalledTimes(1);
      expect(optionsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tag: expect.objectContaining({
            type: 'string',
          }),
        })
      );

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addJSONOutputOptions).toHaveBeenCalledTimes(1);
    });

    it('should provide examples', () => {
      projectReleaseInfoCommand.builder(yargs as Argv);
      expect(exampleSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('handler', () => {
    it('should validate the project config', async () => {
      await projectReleaseInfoCommand.handler(args);
      expect(getProjectConfigSpy).toHaveBeenCalledTimes(1);
      expect(validateProjectConfigSpy).toHaveBeenCalledTimes(1);
    });

    it('should exit with error if project config is invalid', async () => {
      validateProjectConfigSpy.mockImplementation(() => {
        throw new Error('No project config found');
      });

      await projectReleaseInfoCommand.handler(args);

      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should call getReleaseInfo with the correct arguments', async () => {
      await projectReleaseInfoCommand.handler(args);
      expect(getReleaseInfoSpy).toHaveBeenCalledTimes(1);
      expect(getReleaseInfoSpy).toHaveBeenCalledWith(
        args.derivedAccountId,
        'my-project',
        'v1.0.0'
      );
    });

    it('should prepend v prefix when tag is provided without it', async () => {
      args.tag = '1.0.0';
      await projectReleaseInfoCommand.handler(args);
      expect(getReleaseInfoSpy).toHaveBeenCalledWith(
        args.derivedAccountId,
        'my-project',
        'v1.0.0'
      );
    });

    it('should prompt for release selection when tag is not provided', async () => {
      args.tag = undefined as unknown as string;
      listReleasesSpy.mockReturnValue(
        mockHubSpotHttpResponse<FetchListReleasesResponse>(releasesListResponse)
      );
      listPromptSpy.mockResolvedValue('v1.1.0');

      await projectReleaseInfoCommand.handler(args);

      expect(listReleasesSpy).toHaveBeenCalledWith(
        args.derivedAccountId,
        'my-project'
      );
      expect(listPromptSpy).toHaveBeenCalledTimes(1);
      expect(getReleaseInfoSpy).toHaveBeenCalledWith(
        args.derivedAccountId,
        'my-project',
        'v1.1.0'
      );
    });

    it('should exit with error when no releases exist and tag is not provided', async () => {
      args.tag = undefined as unknown as string;
      listReleasesSpy.mockReturnValue(
        mockHubSpotHttpResponse<FetchListReleasesResponse>({
          results: [],
          paging: { next: { after: '' } },
        })
      );

      await projectReleaseInfoCommand.handler(args);

      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('No releases found')
      );
      expect(getReleaseInfoSpy).not.toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should output json when --json is provided', async () => {
      args.json = true;
      await projectReleaseInfoCommand.handler(args);
      expect(uiLogger.json).toHaveBeenCalledTimes(1);
      expect(uiLogger.json).toHaveBeenCalledWith(releaseResponse);
    });

    it('should display release details', async () => {
      await projectReleaseInfoCommand.handler(args);
      expect(uiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('v1.0.0')
      );
    });

    it('should display no components message when components are absent', async () => {
      getReleaseInfoSpy.mockReturnValue(
        mockHubSpotHttpResponse<Release>(releaseWithNoComponents)
      );

      await projectReleaseInfoCommand.handler(args);

      expect(uiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('No components')
      );
    });

    it('should handle 404 error from API', async () => {
      processExitSpy.mockImplementation((code?: string | number | null) => {
        throw new Error(`process.exit called with ${code}`);
      });
      getReleaseInfoSpy.mockImplementation(() => {
        throw mockHubSpotHttpError('Not Found', {
          status: HttpStatusCode.NotFound,
          data: {},
        });
      });

      await expect(projectReleaseInfoCommand.handler(args)).rejects.toThrow();

      expect(uiLogger.error).toHaveBeenCalledTimes(1);
      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('was not found')
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should handle unexpected errors', async () => {
      getReleaseInfoSpy.mockImplementation(() => {
        throw mockHubSpotHttpError('Server Error', {
          status: HttpStatusCode.InternalServerError,
          data: {},
        });
      });

      await projectReleaseInfoCommand.handler(args);

      expect(uiLogger.error).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });
});

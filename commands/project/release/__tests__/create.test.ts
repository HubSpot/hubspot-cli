import { HttpStatusCode } from 'axios';
import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import { Project } from '@hubspot/local-dev-lib/types/Project';
import { Build } from '@hubspot/local-dev-lib/types/Build';
import * as projectApiUtils from '@hubspot/local-dev-lib/api/projects';
import * as releaseApiUtils from '../../../../api/releases.js';
import {
  addAccountOptions,
  addConfigOptions,
  addJSONOutputOptions,
  addUseEnvironmentOptions,
} from '../../../../lib/commonOpts.js';
import * as projectUtils from '../../../../lib/projects/config.js';
import * as promptUtils from '../../../../lib/prompts/promptUtils.js';
import { EXIT_CODES } from '../../../../lib/enums/exitCodes.js';
import { loadJson } from '../../../../lib/jsonLoader.js';
import {
  mockHubSpotHttpResponse,
  mockHubSpotHttpError,
} from '../../../../lib/testUtils.js';
import projectReleaseCreateCommand, {
  ProjectReleaseCreateArgs,
} from '../create.js';
import { uiLogger } from '../../../../lib/ui/logger.js';
import { Release } from '../../../../api/releases.js';
import { expect } from 'vitest';

vi.mock('@hubspot/local-dev-lib/api/projects');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../../../lib/commonOpts');
vi.mock('../../../../lib/validation');
vi.mock('../../../../lib/projects/config');
vi.mock('../../../../lib/prompts/promptUtils');

const exampleProject = loadJson<Project>(
  import.meta.url,
  '../../__tests__/fixtures/exampleProject.json'
);

const getProjectConfigSpy = vi.spyOn(projectUtils, 'getProjectConfig');
const validateProjectConfigSpy = vi.spyOn(
  projectUtils,
  'validateProjectConfig'
);
const fetchProjectSpy = vi.spyOn(projectApiUtils, 'fetchProject');
const getBuildStatusSpy = vi.spyOn(projectApiUtils, 'getBuildStatus');
const createReleaseSpy = vi.spyOn(releaseApiUtils, 'createRelease');
const confirmPromptSpy = vi.spyOn(promptUtils, 'confirmPrompt');
const processExitSpy = vi.spyOn(process, 'exit');

const optionsSpy = vi
  .spyOn(yargs as Argv, 'options')
  .mockReturnValue(yargs as Argv);

const exampleSpy = vi
  .spyOn(yargs as Argv, 'example')
  .mockReturnValue(yargs as Argv);

const exampleRelease: Release = {
  releaseTag: 'v1.0.0',
  buildId: 1,
  createdAt: '2026-02-23T12:00:00.000Z',
};

describe('commands/project/release/create', () => {
  let args: ArgumentsCamelCase<ProjectReleaseCreateArgs>;

  beforeEach(() => {
    vi.clearAllMocks();
    args = {
      derivedAccountId: 1234567890,
    } as ArgumentsCamelCase<ProjectReleaseCreateArgs>;

    getProjectConfigSpy.mockResolvedValue({
      projectConfig: {
        name: 'my-project',
        srcDir: 'src',
        platformVersion: '2025.2',
      },
      projectDir: '/path/to/project',
    });
    validateProjectConfigSpy.mockImplementation(() => {});
    fetchProjectSpy.mockReturnValue(
      mockHubSpotHttpResponse<Project>(exampleProject)
    );
    getBuildStatusSpy.mockReturnValue(
      mockHubSpotHttpResponse<Build>({} as Build)
    );
    createReleaseSpy.mockReturnValue(
      mockHubSpotHttpResponse<Release>(exampleRelease)
    );
    confirmPromptSpy.mockResolvedValue(true);
    // @ts-expect-error Mock implementation
    processExitSpy.mockImplementation(() => {});
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectReleaseCreateCommand.command).toEqual('create');
    });
  });

  describe('describe', () => {
    it('should be hidden', () => {
      expect(projectReleaseCreateCommand.describe).toBeUndefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      projectReleaseCreateCommand.builder(yargs as Argv);

      expect(optionsSpy).toHaveBeenCalledTimes(1);
      expect(optionsSpy).toHaveBeenCalledWith({
        build: expect.objectContaining({
          alias: ['build-id'],
          type: 'number',
        }),
        force: expect.objectContaining({
          alias: ['f'],
          default: false,
          type: 'boolean',
        }),
      });

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addJSONOutputOptions).toHaveBeenCalledTimes(1);
    });

    it('should provide examples', () => {
      projectReleaseCreateCommand.builder(yargs as Argv);
      expect(exampleSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('handler', () => {
    it('should validate the project config', async () => {
      await projectReleaseCreateCommand.handler(args);
      expect(getProjectConfigSpy).toHaveBeenCalledTimes(1);
      expect(validateProjectConfigSpy).toHaveBeenCalledTimes(1);
    });

    it('should exit with error if project config is invalid', async () => {
      validateProjectConfigSpy.mockImplementation(() => {
        throw new Error('No project config found');
      });

      await projectReleaseCreateCommand.handler(args);

      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should always fetch the project', async () => {
      await projectReleaseCreateCommand.handler(args);
      expect(fetchProjectSpy).toHaveBeenCalledTimes(1);
      expect(fetchProjectSpy).toHaveBeenCalledWith(
        args.derivedAccountId,
        'my-project'
      );
    });

    it('should validate the build with getBuildStatus when --build is provided', async () => {
      args.build = 5;
      await projectReleaseCreateCommand.handler(args);
      expect(getBuildStatusSpy).toHaveBeenCalledTimes(1);
      expect(getBuildStatusSpy).toHaveBeenCalledWith(
        args.derivedAccountId,
        'my-project',
        5
      );
    });

    it('should not call getBuildStatus when --build is not provided', async () => {
      await projectReleaseCreateCommand.handler(args);
      expect(getBuildStatusSpy).not.toHaveBeenCalled();
    });

    it('should error when no deployed build exists and --build is not provided', async () => {
      fetchProjectSpy.mockReturnValue(
        mockHubSpotHttpResponse<Project>({
          ...exampleProject,
          deployedBuildId: undefined,
        })
      );

      await projectReleaseCreateCommand.handler(args);

      expect(uiLogger.error).toHaveBeenCalledTimes(1);
      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('No deployed build found for this project')
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should show build not found when getBuildStatus returns 404', async () => {
      processExitSpy.mockImplementation((code?: string | number | null) => {
        throw new Error(`process.exit called with ${code}`);
      });
      args.build = 999;
      getBuildStatusSpy.mockImplementation(() => {
        throw mockHubSpotHttpError('Build does not exist', {
          status: HttpStatusCode.NotFound,
          data: {
            message: 'Build `999` does not exist in `my-project`.',
          },
        });
      });

      await expect(projectReleaseCreateCommand.handler(args)).rejects.toThrow();

      expect(uiLogger.error).toHaveBeenCalledTimes(1);
      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('999')
      );
      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('was not found')
      );
      expect(confirmPromptSpy).not.toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should use generic error handler when getBuildStatus returns a non-404 error', async () => {
      processExitSpy.mockImplementation((code?: string | number | null) => {
        throw new Error(`process.exit called with ${code}`);
      });
      args.build = 5;
      getBuildStatusSpy.mockImplementation(() => {
        throw mockHubSpotHttpError('Server Error', {
          status: HttpStatusCode.InternalServerError,
          data: {},
        });
      });

      await expect(projectReleaseCreateCommand.handler(args)).rejects.toThrow();

      expect(uiLogger.error).toHaveBeenCalledTimes(1);
      expect(confirmPromptSpy).not.toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should show project not found when fetchProject returns 404 even with --build', async () => {
      processExitSpy.mockImplementation((code?: string | number | null) => {
        throw new Error(`process.exit called with ${code}`);
      });
      args.build = 5;
      fetchProjectSpy.mockImplementation(() => {
        throw mockHubSpotHttpError('Not Found', {
          status: HttpStatusCode.NotFound,
          data: {},
        });
      });

      await expect(projectReleaseCreateCommand.handler(args)).rejects.toThrow();

      expect(uiLogger.error).toHaveBeenCalledTimes(1);
      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('does not exist')
      );
      expect(getBuildStatusSpy).not.toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should show project not found when fetchProject returns 404', async () => {
      processExitSpy.mockImplementation((code?: string | number | null) => {
        throw new Error(`process.exit called with ${code}`);
      });
      fetchProjectSpy.mockImplementation(() => {
        throw mockHubSpotHttpError('Not Found', {
          status: HttpStatusCode.NotFound,
          data: {},
        });
      });

      await expect(projectReleaseCreateCommand.handler(args)).rejects.toThrow();

      expect(uiLogger.error).toHaveBeenCalledTimes(1);
      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('does not exist')
      );
      expect(confirmPromptSpy).not.toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should prompt for confirmation after validation and before creating release', async () => {
      await projectReleaseCreateCommand.handler(args);
      expect(fetchProjectSpy).toHaveBeenCalledTimes(1);
      expect(confirmPromptSpy).toHaveBeenCalledTimes(1);
      expect(confirmPromptSpy).toHaveBeenCalledWith(
        expect.stringContaining('my-project')
      );
      expect(createReleaseSpy).toHaveBeenCalledTimes(1);
    });

    it('should exit cleanly when user declines confirmation', async () => {
      processExitSpy.mockImplementation((code?: string | number | null) => {
        throw new Error(`process.exit called with ${code}`);
      });
      confirmPromptSpy.mockResolvedValue(false);

      await expect(projectReleaseCreateCommand.handler(args)).rejects.toThrow();

      expect(uiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('cancelled')
      );
      expect(createReleaseSpy).not.toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should skip confirmation when --json is provided', async () => {
      args.json = true;
      await projectReleaseCreateCommand.handler(args);
      expect(confirmPromptSpy).not.toHaveBeenCalled();
      expect(createReleaseSpy).toHaveBeenCalledTimes(1);
    });

    it('should skip confirmation when --force is provided', async () => {
      args.force = true;
      await projectReleaseCreateCommand.handler(args);
      expect(confirmPromptSpy).not.toHaveBeenCalled();
      expect(createReleaseSpy).toHaveBeenCalledTimes(1);
    });

    it('should create the release with the deployed build id', async () => {
      await projectReleaseCreateCommand.handler(args);
      expect(createReleaseSpy).toHaveBeenCalledTimes(1);
      expect(createReleaseSpy).toHaveBeenCalledWith(
        args.derivedAccountId,
        'my-project',
        exampleProject.deployedBuildId
      );
    });

    it('should create the release with the provided --build', async () => {
      args.build = 42;
      await projectReleaseCreateCommand.handler(args);
      expect(createReleaseSpy).toHaveBeenCalledTimes(1);
      expect(createReleaseSpy).toHaveBeenCalledWith(
        args.derivedAccountId,
        'my-project',
        42
      );
    });

    it('should log success message with release tag', async () => {
      await projectReleaseCreateCommand.handler(args);
      expect(uiLogger.success).toHaveBeenCalledTimes(1);
      expect(uiLogger.success).toHaveBeenCalledWith(
        expect.stringContaining('v1.0.0')
      );
    });

    it('should output json when --json is provided', async () => {
      args.json = true;
      await projectReleaseCreateCommand.handler(args);
      expect(uiLogger.json).toHaveBeenCalledTimes(1);
      expect(uiLogger.json).toHaveBeenCalledWith(exampleRelease);
    });

    it('should handle 422 error when build not deployed', async () => {
      createReleaseSpy.mockImplementation(() => {
        throw mockHubSpotHttpError('Build not deployed', {
          status: HttpStatusCode.UnprocessableEntity,
          data: {},
        });
      });

      await projectReleaseCreateCommand.handler(args);

      expect(uiLogger.error).toHaveBeenCalledTimes(1);
      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('has not been deployed')
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should handle unexpected errors', async () => {
      createReleaseSpy.mockImplementation(() => {
        throw mockHubSpotHttpError('Server Error', {
          status: HttpStatusCode.InternalServerError,
          data: {},
        });
      });

      await projectReleaseCreateCommand.handler(args);

      expect(uiLogger.error).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });
});

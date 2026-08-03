import { HttpStatusCode } from 'axios';
import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import { ProjectPollResult } from '../../../../types/Projects.js';
import * as releaseLib from '../../../../lib/projects/release.js';
import * as uploadUtils from '../../../../lib/projects/upload.js';
import {
  addAccountOptions,
  addConfigOptions,
  addJSONOutputOptions,
  addUseEnvironmentOptions,
} from '../../../../lib/commonOpts.js';
import * as projectUtils from '../../../../lib/projects/config.js';
import * as promptUtils from '../../../../lib/prompts/promptUtils.js';
import { EXIT_CODES } from '../../../../lib/enums/exitCodes.js';
import { mockHubSpotHttpError } from '../../../../lib/testUtils.js';
import { PromptExitError } from '../../../../lib/errors/PromptExitError.js';
import projectReleaseCreateCommand, {
  ProjectReleaseCreateArgs,
} from '../create.js';
import { uiLogger } from '../../../../lib/ui/logger.js';
import { Release } from '../../../../api/releases.js';
import { expect } from 'vitest';

vi.mock('@hubspot/local-dev-lib/config');
vi.mock('@hubspot/project-parsing-lib/projects');
vi.mock('../../../../lib/commonOpts');
vi.mock('../../../../lib/validation');
vi.mock('../../../../lib/projects/config');
vi.mock('../../../../lib/prompts/promptUtils');
vi.mock('../../../../lib/projects/upload.js');
vi.mock('../../../../lib/projects/release.js');

const getProjectConfigSpy = vi.spyOn(projectUtils, 'getProjectConfig');
const validateProjectConfigSpy = vi.spyOn(
  projectUtils,
  'validateProjectConfig'
);
const resolveBuildIdSpy = vi.spyOn(releaseLib, 'resolveBuildId');
const validateBuildForReleaseSpy = vi.spyOn(
  releaseLib,
  'validateBuildForRelease'
);
const executeReleaseSpy = vi.spyOn(releaseLib, 'executeRelease');
const handleProjectUploadSpy = vi.spyOn(uploadUtils, 'handleProjectUpload');
const confirmPromptSpy = vi.spyOn(promptUtils, 'confirmPrompt');
const processExitSpy = vi.spyOn(process, 'exit');

const optionsSpy = vi
  .spyOn(yargs as Argv, 'options')
  .mockReturnValue(yargs as Argv);

const exampleSpy = vi
  .spyOn(yargs as Argv, 'example')
  .mockReturnValue(yargs as Argv);

const EXAMPLE_BUILD_ID = 8;

describe('commands/project/release/create', () => {
  let args: ArgumentsCamelCase<ProjectReleaseCreateArgs>;

  beforeEach(() => {
    vi.clearAllMocks();
    args = {
      derivedAccountId: 1234567890,
      addJsonOutput: vi.fn(),
    } as unknown as ArgumentsCamelCase<ProjectReleaseCreateArgs>;

    getProjectConfigSpy.mockResolvedValue({
      projectConfig: {
        name: 'my-project',
        srcDir: 'src',
        platformVersion: '2025.2',
      },
      projectDir: '/path/to/project',
    });
    validateProjectConfigSpy.mockImplementation(() => {});
    resolveBuildIdSpy.mockResolvedValue(EXAMPLE_BUILD_ID);
    validateBuildForReleaseSpy.mockResolvedValue(true);
    executeReleaseSpy.mockResolvedValue({
      releaseTag: 'v1.0.0',
      buildId: EXAMPLE_BUILD_ID,
      createdAt: '2026-02-23T12:00:00.000Z',
    } as Release);
    handleProjectUploadSpy.mockResolvedValue({
      result: {
        succeeded: true,
        buildId: 99,
      } as ProjectPollResult,
    });
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

    it('should call resolveBuildId with account, project, buildOption, and force', async () => {
      args.build = 5;
      args.force = true;
      await projectReleaseCreateCommand.handler(args);
      expect(resolveBuildIdSpy).toHaveBeenCalledWith(
        args.derivedAccountId,
        'my-project',
        5,
        true
      );
    });

    it('should handle PromptExitError from resolveBuildId', async () => {
      resolveBuildIdSpy.mockRejectedValue(
        new PromptExitError('User exited', EXIT_CODES.SUCCESS)
      );
      await projectReleaseCreateCommand.handler(args);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should exit with error when resolveBuildId throws a non-prompt error', async () => {
      resolveBuildIdSpy.mockRejectedValue(
        mockHubSpotHttpError('Server Error', {
          status: HttpStatusCode.InternalServerError,
          data: {},
        })
      );
      await projectReleaseCreateCommand.handler(args);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should call validateBuild with the resolved build id', async () => {
      args.build = 5;
      resolveBuildIdSpy.mockResolvedValue(5);
      await projectReleaseCreateCommand.handler(args);
      expect(validateBuildForReleaseSpy).toHaveBeenCalledWith(
        args.derivedAccountId,
        'my-project',
        5
      );
    });

    it('should call validateBuild even when --build is not provided', async () => {
      await projectReleaseCreateCommand.handler(args);
      expect(validateBuildForReleaseSpy).toHaveBeenCalledWith(
        args.derivedAccountId,
        'my-project',
        EXAMPLE_BUILD_ID
      );
    });

    it('should exit with error when validateBuild throws', async () => {
      validateBuildForReleaseSpy.mockRejectedValue(
        mockHubSpotHttpError('Not found', {
          status: HttpStatusCode.NotFound,
          data: {},
        })
      );
      await projectReleaseCreateCommand.handler(args);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should exit with error when build platform version does not support releases', async () => {
      validateBuildForReleaseSpy.mockResolvedValue(false);
      await projectReleaseCreateCommand.handler(args);
      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('not support releases')
      );
      expect(executeReleaseSpy).not.toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should exit with error when resolveBuildId returns null (no successful builds)', async () => {
      resolveBuildIdSpy.mockResolvedValue(null);
      await projectReleaseCreateCommand.handler(args);
      expect(confirmPromptSpy).not.toHaveBeenCalled();
      expect(handleProjectUploadSpy).not.toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should prompt user to upload when resolveBuildId returns undefined', async () => {
      resolveBuildIdSpy.mockResolvedValue(undefined);
      confirmPromptSpy.mockResolvedValueOnce(false);
      await projectReleaseCreateCommand.handler(args);
      expect(confirmPromptSpy).toHaveBeenCalledWith(
        expect.stringContaining('No successful builds')
      );
      expect(handleProjectUploadSpy).not.toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should run upload and create release when user confirms upload prompt', async () => {
      resolveBuildIdSpy.mockResolvedValue(undefined);
      await projectReleaseCreateCommand.handler(args);
      expect(handleProjectUploadSpy).toHaveBeenCalledTimes(1);
      expect(executeReleaseSpy).toHaveBeenCalledWith(
        args.derivedAccountId,
        'my-project',
        99
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should exit cleanly when user declines upload prompt', async () => {
      resolveBuildIdSpy.mockResolvedValue(undefined);
      confirmPromptSpy.mockResolvedValue(false);
      await projectReleaseCreateCommand.handler(args);
      expect(handleProjectUploadSpy).not.toHaveBeenCalled();
      expect(executeReleaseSpy).not.toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should upload directly when --force is set and resolveBuildId returns undefined', async () => {
      resolveBuildIdSpy.mockResolvedValue(undefined);
      args.force = true;
      await projectReleaseCreateCommand.handler(args);
      expect(confirmPromptSpy).not.toHaveBeenCalled();
      expect(handleProjectUploadSpy).toHaveBeenCalledTimes(1);
      expect(executeReleaseSpy).toHaveBeenCalledWith(
        args.derivedAccountId,
        'my-project',
        99
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should handle PromptExitError from upload prompt', async () => {
      resolveBuildIdSpy.mockResolvedValue(undefined);
      confirmPromptSpy.mockRejectedValue(
        new PromptExitError('User exited', EXIT_CODES.SUCCESS)
      );
      await projectReleaseCreateCommand.handler(args);
      expect(handleProjectUploadSpy).not.toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should prompt for confirmation before creating release', async () => {
      await projectReleaseCreateCommand.handler(args);
      expect(confirmPromptSpy).toHaveBeenCalledTimes(1);
      expect(confirmPromptSpy).toHaveBeenCalledWith(
        expect.stringContaining('my-project')
      );
      expect(executeReleaseSpy).toHaveBeenCalledTimes(1);
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
      expect(executeReleaseSpy).not.toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should skip confirmation when --json is provided', async () => {
      args.json = true;
      await projectReleaseCreateCommand.handler(args);
      expect(confirmPromptSpy).not.toHaveBeenCalled();
      expect(executeReleaseSpy).toHaveBeenCalledTimes(1);
    });

    it('should skip confirmation when --force is provided', async () => {
      args.force = true;
      await projectReleaseCreateCommand.handler(args);
      expect(confirmPromptSpy).not.toHaveBeenCalled();
      expect(executeReleaseSpy).toHaveBeenCalledTimes(1);
    });

    it('should call executeRelease with the resolved build id', async () => {
      await projectReleaseCreateCommand.handler(args);
      expect(executeReleaseSpy).toHaveBeenCalledWith(
        args.derivedAccountId,
        'my-project',
        EXAMPLE_BUILD_ID
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should log success message after creating release', async () => {
      await projectReleaseCreateCommand.handler(args);
      expect(uiLogger.success).toHaveBeenCalledWith(
        expect.stringContaining('v1.0.0')
      );
    });

    it('should exit with error when executeRelease throws', async () => {
      executeReleaseSpy.mockRejectedValue(new Error('API error'));
      await projectReleaseCreateCommand.handler(args);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });
});

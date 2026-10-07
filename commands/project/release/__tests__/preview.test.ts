import { HttpStatusCode } from 'axios';
import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import { ProjectPollResult } from '../../../../types/Projects.js';
import * as releaseLib from '../../../../lib/projects/release.js';
import * as previewLib from '../../../../lib/projects/preview.js';
import * as uploadUtils from '../../../../lib/projects/upload.js';
import * as projectsApi from '@hubspot/local-dev-lib/api/projects';
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
import projectReleasePreviewCommand, {
  ProjectReleasePreviewArgs,
} from '../preview.js';
import { expect } from 'vitest';

vi.mock('@hubspot/local-dev-lib/config');
vi.mock('@hubspot/local-dev-lib/api/projects');
vi.mock('@hubspot/project-parsing-lib/projects');
vi.mock('../../../../lib/commonOpts');
vi.mock('../../../../lib/validation');
vi.mock('../../../../lib/projects/config');
vi.mock('../../../../lib/prompts/promptUtils');
vi.mock('../../../../lib/projects/upload.js');
vi.mock('../../../../lib/projects/release.js');
vi.mock('../../../../lib/projects/preview.js');

const getProjectConfigSpy = vi.spyOn(projectUtils, 'getProjectConfig');
const resolveBuildIdSpy = vi.spyOn(releaseLib, 'resolveBuildId');
const triggerAndPollPreviewSpy = vi.spyOn(previewLib, 'triggerAndPollPreview');
const handleProjectUploadSpy = vi.spyOn(uploadUtils, 'handleProjectUpload');
const fetchProjectSpy = vi.spyOn(projectsApi, 'fetchProject');
const confirmPromptSpy = vi.spyOn(promptUtils, 'confirmPrompt');
const processExitSpy = vi.spyOn(process, 'exit');

const optionsSpy = vi
  .spyOn(yargs as Argv, 'options')
  .mockReturnValue(yargs as Argv);

const exampleSpy = vi
  .spyOn(yargs as Argv, 'example')
  .mockReturnValue(yargs as Argv);

const EXAMPLE_BUILD_ID = 8;
const EXAMPLE_PROJECT_ID = 555;
const EXAMPLE_TARGET_PORTAL_ID = 12345;

function mockFetchProject(id: number): void {
  fetchProjectSpy.mockResolvedValue({
    data: { id },
  } as unknown as Awaited<ReturnType<typeof projectsApi.fetchProject>>);
}

describe('commands/project/release/preview', () => {
  let args: ArgumentsCamelCase<ProjectReleasePreviewArgs>;

  beforeEach(() => {
    vi.clearAllMocks();
    args = {
      derivedAccountId: 1234567890,
      target: EXAMPLE_TARGET_PORTAL_ID,
      addJsonOutput: vi.fn(),
    } as unknown as ArgumentsCamelCase<ProjectReleasePreviewArgs>;

    getProjectConfigSpy.mockReturnValue({
      projectConfig: {
        name: 'my-project',
        srcDir: 'src',
        platformVersion: '2027.03',
      },
      projectDir: '/path/to/project',
    });
    resolveBuildIdSpy.mockResolvedValue(EXAMPLE_BUILD_ID);
    mockFetchProject(EXAMPLE_PROJECT_ID);
    triggerAndPollPreviewSpy.mockResolvedValue({
      succeeded: true,
      releaseTag: 'v1.0.0',
      appId: 1,
    });
    handleProjectUploadSpy.mockResolvedValue({
      result: {
        succeeded: true,
        buildId: 99,
      } as ProjectPollResult,
      projectId: EXAMPLE_PROJECT_ID,
    });
    confirmPromptSpy.mockResolvedValue(true);
    // @ts-expect-error Mock implementation
    processExitSpy.mockImplementation(() => {});
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectReleasePreviewCommand.command).toEqual('preview');
    });
  });

  describe('describe', () => {
    it('should be hidden', () => {
      expect(projectReleasePreviewCommand.describe).toBeUndefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      projectReleasePreviewCommand.builder(yargs as Argv);

      expect(optionsSpy).toHaveBeenCalledTimes(1);
      expect(optionsSpy).toHaveBeenCalledWith({
        build: expect.objectContaining({
          alias: ['build-id'],
          type: 'number',
        }),
        target: expect.objectContaining({
          type: 'number',
          requiresArg: true,
          demandOption: expect.anything(),
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
      projectReleasePreviewCommand.builder(yargs as Argv);
      expect(exampleSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('handler', () => {
    it('should get the project config', async () => {
      await projectReleasePreviewCommand.handler(args);
      expect(getProjectConfigSpy).toHaveBeenCalledTimes(1);
    });

    it('should exit with error if project config is not found', async () => {
      getProjectConfigSpy.mockImplementation(() => {
        throw new Error('No project config found');
      });
      await projectReleasePreviewCommand.handler(args);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should call resolveBuildId with account, project, buildOption, and force', async () => {
      args.build = 5;
      args.force = true;
      await projectReleasePreviewCommand.handler(args);
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
      await projectReleasePreviewCommand.handler(args);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should exit with error when resolveBuildId returns null', async () => {
      resolveBuildIdSpy.mockResolvedValue(null);
      await projectReleasePreviewCommand.handler(args);
      expect(triggerAndPollPreviewSpy).not.toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should fetch the project id and preview an existing build', async () => {
      await projectReleasePreviewCommand.handler(args);
      expect(fetchProjectSpy).toHaveBeenCalledWith(
        args.derivedAccountId,
        'my-project'
      );
      expect(triggerAndPollPreviewSpy).toHaveBeenCalledWith(
        args.derivedAccountId,
        EXAMPLE_PROJECT_ID,
        EXAMPLE_BUILD_ID,
        EXAMPLE_TARGET_PORTAL_ID
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should upload and use the uploaded project id when no build exists', async () => {
      resolveBuildIdSpy.mockResolvedValue(undefined);
      await projectReleasePreviewCommand.handler(args);
      expect(handleProjectUploadSpy).toHaveBeenCalledTimes(1);
      expect(fetchProjectSpy).not.toHaveBeenCalled();
      expect(triggerAndPollPreviewSpy).toHaveBeenCalledWith(
        args.derivedAccountId,
        EXAMPLE_PROJECT_ID,
        99,
        EXAMPLE_TARGET_PORTAL_ID
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should forward force to handleProjectUpload so translation prompts are skipped', async () => {
      resolveBuildIdSpy.mockResolvedValue(undefined);
      args.force = true;
      await projectReleasePreviewCommand.handler(args);
      expect(handleProjectUploadSpy).toHaveBeenCalledWith(
        expect.objectContaining({ force: true, forceCreate: true })
      );
    });

    it('should exit cleanly when user declines upload prompt', async () => {
      resolveBuildIdSpy.mockResolvedValue(undefined);
      confirmPromptSpy.mockResolvedValue(false);
      await projectReleasePreviewCommand.handler(args);
      expect(handleProjectUploadSpy).not.toHaveBeenCalled();
      expect(triggerAndPollPreviewSpy).not.toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should exit with error when the upload fails', async () => {
      resolveBuildIdSpy.mockResolvedValue(undefined);
      handleProjectUploadSpy.mockResolvedValue({
        result: {
          succeeded: false,
          buildId: 99,
        } as ProjectPollResult,
      });
      await projectReleasePreviewCommand.handler(args);
      expect(triggerAndPollPreviewSpy).not.toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should exit with error when fetchProject throws', async () => {
      fetchProjectSpy.mockRejectedValue(
        mockHubSpotHttpError('Not found', {
          status: HttpStatusCode.NotFound,
          data: {},
        })
      );
      await projectReleasePreviewCommand.handler(args);
      expect(triggerAndPollPreviewSpy).not.toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should exit with error when the preview does not succeed', async () => {
      triggerAndPollPreviewSpy.mockResolvedValue({ succeeded: false });
      await projectReleasePreviewCommand.handler(args);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });
});

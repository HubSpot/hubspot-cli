import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
  addJSONOutputOptions,
} from '../../../lib/commonOpts.js';
import * as configUtils from '@hubspot/local-dev-lib/config';
import * as errorsLib from '@hubspot/local-dev-lib/errors/index';
import { uiLogger } from '../../../lib/ui/logger.js';
import * as platformVersionLib from '../../../lib/projects/platformVersion.js';
import * as usageTrackingLib from '../../../lib/usageTracking.js';
import * as projectConfigLib from '../../../lib/projects/config.js';
import * as projectProfilesLib from '../../../lib/projects/projectProfiles.js';
import * as projectProfilePromptLib from '../../../lib/prompts/projectProfilePrompt.js';
import * as pollProjectLib from '../../../lib/projects/pollProjectBuildAndDeploy.js';
import * as uploadLib from '../../../lib/projects/upload.js';
import * as uiLib from '../../../lib/projects/ui.js';
import * as errorHandlers from '../../../lib/errorHandlers/index.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import { PROJECT_ERROR_TYPES } from '../../../lib/constants.js';
import projectUploadCommand, { ProjectUploadArgs } from '../upload.js';

vi.mock('../../../lib/commonOpts');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('@hubspot/local-dev-lib/errors/index');
vi.mock('../../../lib/projects/platformVersion.js');
vi.mock('../../../lib/projects/config.js');
vi.mock('../../../lib/projects/projectProfiles.js');
vi.mock('../../../lib/prompts/projectProfilePrompt.js');
vi.mock('../../../lib/projects/pollProjectBuildAndDeploy.js');
vi.mock('../../../lib/projects/upload.js');
vi.mock('../../../lib/projects/ui.js');
vi.mock('../../../lib/errorHandlers/index.js');

const optionsSpy = vi.spyOn(yargs as Argv, 'options');
const exampleSpy = vi.spyOn(yargs as Argv, 'example');
const conflictsSpy = vi.spyOn(yargs as Argv, 'conflicts');
const getProjectConfigSpy = vi.spyOn(projectConfigLib, 'getProjectConfig');
const validateProjectConfigSpy = vi.spyOn(
  projectConfigLib,
  'validateProjectConfig'
);
const isV2ProjectSpy = vi.spyOn(platformVersionLib, 'isV2Project');
const loadAndValidateProfileSpy = vi.spyOn(
  projectProfilesLib,
  'loadAndValidateProfile'
);
const projectProfilePromptSpy = vi.spyOn(
  projectProfilePromptLib,
  'projectProfilePrompt'
);
const getConfigAccountByIdSpy = vi.spyOn(configUtils, 'getConfigAccountById');
const trackCommandUsageSpy = vi.spyOn(usageTrackingLib, 'trackCommandUsage');
const handleProjectUploadSpy = vi.spyOn(uploadLib, 'handleProjectUpload');
const pollProjectBuildAndDeploySpy = vi.spyOn(
  pollProjectLib,
  'pollProjectBuildAndDeploy'
);
const displayWarnLogsSpy = vi.spyOn(pollProjectLib, 'displayWarnLogs');
const logFeedbackMessageSpy = vi.spyOn(uiLib, 'logFeedbackMessage');
const isSpecifiedErrorSpy = vi.spyOn(errorsLib, 'isSpecifiedError');
const processExitSpy = vi.spyOn(process, 'exit');
const logErrorSpy = vi.spyOn(errorHandlers, 'logError');

describe('commands/project/upload', () => {
  beforeEach(() => {
    // @ts-expect-error Mock implementation
    processExitSpy.mockImplementation(() => {});
    getProjectConfigSpy.mockResolvedValue({
      projectConfig: {
        name: 'test-project',
        srcDir: 'src',
        platformVersion: '2024.1',
      },
      projectDir: '/test/project',
    });
    validateProjectConfigSpy.mockImplementation(() => {});
    isV2ProjectSpy.mockReturnValue(false);
    // @ts-expect-error Mock config account doesn't need full type implementation
    getConfigAccountByIdSpy.mockReturnValue({
      accountId: 123456,
      accountType: 'STANDARD',
    });
    handleProjectUploadSpy.mockResolvedValue({
      result: {
        succeeded: true,
        buildId: 123,
        buildResult: { isAutoDeployEnabled: true },
      },
      uploadError: null,
    });
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectUploadCommand.command).toEqual('upload');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(projectUploadCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      projectUploadCommand.builder(yargs as Argv);

      expect(conflictsSpy).toHaveBeenCalledTimes(1);
      expect(conflictsSpy).toHaveBeenCalledWith('profile', 'account');

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargs);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargs);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargs);

      expect(addJSONOutputOptions).toHaveBeenCalledTimes(1);
      expect(addJSONOutputOptions).toHaveBeenCalledWith(yargs);
    });

    it('should define force-create, message, and skip-validation options', () => {
      projectUploadCommand.builder(yargs as Argv);

      expect(optionsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          'force-create': expect.any(Object),
          message: expect.any(Object),
          'skip-validation': expect.any(Object),
        })
      );

      expect(exampleSpy).toHaveBeenCalled();
    });
  });

  describe('handler', () => {
    let args: ArgumentsCamelCase<ProjectUploadArgs>;

    beforeEach(() => {
      args = {
        forceCreate: false,
        message: 'Test upload',
        derivedAccountId: 123456,
        skipValidation: false,
        formatOutputAsJson: false,
      } as ArgumentsCamelCase<ProjectUploadArgs>;
    });

    it('should get and validate project config', async () => {
      await projectUploadCommand.handler(args);

      expect(getProjectConfigSpy).toHaveBeenCalled();
      expect(validateProjectConfigSpy).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'test-project' }),
        '/test/project'
      );
    });

    it('should exit if project config validation fails', async () => {
      const error = new Error('Invalid config');
      validateProjectConfigSpy.mockImplementation(() => {
        throw error;
      });

      await projectUploadCommand.handler(args);

      expect(logErrorSpy).toHaveBeenCalledWith(error);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should load and validate profile for v2 projects', async () => {
      isV2ProjectSpy.mockReturnValue(true);
      args.profile = 'test-profile';
      projectProfilePromptSpy.mockResolvedValue('test-profile');
      loadAndValidateProfileSpy.mockResolvedValue({ accountId: 12345 });

      await projectUploadCommand.handler(args);

      expect(isV2ProjectSpy).toHaveBeenCalled();
      expect(loadAndValidateProfileSpy).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'test-project' }),
        '/test/project',
        'test-profile'
      );
    });

    it('should exit if profile validation fails', async () => {
      isV2ProjectSpy.mockReturnValue(true);
      const error = new Error('Invalid profile');
      projectProfilePromptSpy.mockResolvedValue('test');
      loadAndValidateProfileSpy.mockRejectedValue(error);

      await projectUploadCommand.handler({ ...args, profile: 'test' });

      expect(logErrorSpy).toHaveBeenCalledWith(error);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should track command usage', async () => {
      await projectUploadCommand.handler(args);

      expect(trackCommandUsageSpy).toHaveBeenCalledWith(
        'project-upload',
        { type: 'STANDARD', assetType: '2024.1', successful: true },
        123456
      );
    });

    it('should handle project upload', async () => {
      await projectUploadCommand.handler(args);

      expect(handleProjectUploadSpy).toHaveBeenCalledWith({
        accountId: 123456,
        projectConfig: expect.objectContaining({ name: 'test-project' }),
        projectDir: '/test/project',
        callbackFunc: pollProjectBuildAndDeploySpy,
        uploadMessage: 'Test upload',
        forceCreate: false,
        isUploadCommand: true,
        sendIR: false,
        skipValidation: false,
        profile: undefined,
      });
    });

    it('should handle project locked error', async () => {
      const error = new Error('Project locked');
      isSpecifiedErrorSpy.mockReturnValue(true);
      handleProjectUploadSpy.mockResolvedValue({
        result: null,
        uploadError: error,
      });

      await projectUploadCommand.handler(args);

      expect(isSpecifiedErrorSpy).toHaveBeenCalledWith(error, {
        subCategory: PROJECT_ERROR_TYPES.PROJECT_LOCKED,
      });
      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('locked')
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should handle upload errors', async () => {
      const error = new Error('Upload failed');
      isSpecifiedErrorSpy.mockReturnValue(false);
      handleProjectUploadSpy.mockResolvedValue({
        result: null,
        uploadError: error,
      });

      await projectUploadCommand.handler(args);

      expect(logErrorSpy).toHaveBeenCalledWith(
        error,
        expect.any(errorHandlers.ApiErrorContext)
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should handle successful build with auto-deploy disabled', async () => {
      handleProjectUploadSpy.mockResolvedValue({
        result: {
          succeeded: true,
          buildId: 456,
          buildResult: { isAutoDeployEnabled: false },
        },
        uploadError: null,
      });

      await projectUploadCommand.handler(args);

      expect(uiLogger.log).toHaveBeenCalledWith(expect.stringContaining('456'));
      expect(uiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('deploy')
      );
      expect(logFeedbackMessageSpy).toHaveBeenCalledWith(456);
      expect(displayWarnLogsSpy).toHaveBeenCalledWith(
        123456,
        'test-project',
        456
      );
    });

    it('should output JSON when formatOutputAsJson is true', async () => {
      args.formatOutputAsJson = true;
      handleProjectUploadSpy.mockResolvedValue({
        result: {
          succeeded: true,
          buildId: 789,
          buildResult: { isAutoDeployEnabled: true },
          deployResult: { deployId: 101112 },
        },
        uploadError: null,
      });

      await projectUploadCommand.handler(args);

      expect(uiLogger.json).toHaveBeenCalledWith({
        buildId: 789,
        deployId: 101112,
      });
    });

    it('should exit with SUCCESS code when complete', async () => {
      await projectUploadCommand.handler(args);

      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should handle exceptions during upload', async () => {
      const error = new Error('Unexpected error');
      handleProjectUploadSpy.mockRejectedValue(error);

      await projectUploadCommand.handler(args);

      expect(logErrorSpy).toHaveBeenCalledWith(
        error,
        expect.any(errorHandlers.ApiErrorContext)
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    describe('with useEnv flag', () => {
      beforeEach(() => {
        args.useEnv = 'qa';
        isV2ProjectSpy.mockReturnValue(true);
      });

      it('should call projectProfilePrompt with exitIfMissing=true when useEnv is set', async () => {
        const testProjectDir = '/test/project';
        const testConfig = {
          name: 'test-project',
          srcDir: 'src',
          platformVersion: '2025.2',
        };
        getProjectConfigSpy.mockResolvedValue({
          projectConfig: testConfig,
          projectDir: testProjectDir,
        });
        projectProfilePromptSpy.mockResolvedValue(null);

        await projectUploadCommand.handler(args);

        expect(projectProfilePromptSpy).toHaveBeenCalledWith(
          testProjectDir,
          testConfig,
          undefined,
          true
        );
      });

      it('should exit if projectProfilePrompt throws when exitIfMissing=true', async () => {
        projectProfilePromptSpy.mockRejectedValue(
          new Error('Profile required but not specified')
        );

        await projectUploadCommand.handler(args);

        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      });

      it('should load and validate profile when returned from prompt', async () => {
        const testProjectDir = '/test/project';
        const testConfig = {
          name: 'test-project',
          srcDir: 'src',
          platformVersion: '2025.2',
        };
        const mockProfile = {
          accountId: 999888777,
        };
        getProjectConfigSpy.mockResolvedValue({
          projectConfig: testConfig,
          projectDir: testProjectDir,
        });
        projectProfilePromptSpy.mockResolvedValue('test-profile');
        loadAndValidateProfileSpy.mockResolvedValue(mockProfile);

        await projectUploadCommand.handler(args);

        expect(loadAndValidateProfileSpy).toHaveBeenCalledWith(
          testConfig,
          testProjectDir,
          'test-profile'
        );
        expect(handleProjectUploadSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            accountId: mockProfile.accountId,
          })
        );
      });
    });
  });
});

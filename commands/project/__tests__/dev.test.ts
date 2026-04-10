/* eslint-disable @typescript-eslint/no-explicit-any */
import { ArgumentsCamelCase } from 'yargs';
import * as configLib from '@hubspot/local-dev-lib/config';
import * as projectConfigLib from '../../../lib/projects/config.js';
import * as platformVersionLib from '../../../lib/projects/platformVersion.js';
import * as projectProfilesLib from '../../../lib/projects/projectProfiles.js';
import * as projectParsingProfiles from '@hubspot/project-parsing-lib/profiles';
import * as promptUtilsLib from '../../../lib/prompts/promptUtils.js';
import * as usageTrackingLib from '../../../lib/usageTracking.js';
import * as errorHandlers from '../../../lib/errorHandlers/index.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import * as deprecatedFlowLib from '../dev/deprecatedFlow.js';
import * as unifiedFlowLib from '../dev/unifiedFlow.js';
import projectDevCommand from '../dev/index.js';
import { ProjectDevArgs } from '../../../types/Yargs.js';

vi.mock('@hubspot/local-dev-lib/config');
vi.mock('@hubspot/project-parsing-lib/profiles');
vi.mock('../../../lib/projects/config.js');
vi.mock('../../../lib/projects/platformVersion.js');
vi.mock('../../../lib/projects/projectProfiles.js');
vi.mock('../../../lib/prompts/promptUtils.js');
vi.mock('../../../lib/errorHandlers/index.js');
vi.mock('../../../lib/ui/index.js');
vi.mock('../dev/deprecatedFlow.js');
vi.mock('../dev/unifiedFlow.js');

const getConfigAccountIfExistsSpy = vi.spyOn(
  configLib,
  'getConfigAccountIfExists'
);
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
const loadProfileSpy = vi.spyOn(projectProfilesLib, 'loadProfile');
const getAllHsProfilesSpy = vi.spyOn(
  projectParsingProfiles,
  'getAllHsProfiles'
);
const listPromptSpy = vi.spyOn(promptUtilsLib, 'listPrompt');
const trackCommandUsageSpy = vi.spyOn(usageTrackingLib, 'trackCommandUsage');
const logErrorSpy = vi.spyOn(errorHandlers, 'logError');
const deprecatedProjectDevFlowSpy = vi.spyOn(
  deprecatedFlowLib,
  'deprecatedProjectDevFlow'
);
const unifiedProjectDevFlowSpy = vi.spyOn(
  unifiedFlowLib,
  'unifiedProjectDevFlow'
);
const processExitSpy = vi.spyOn(process, 'exit');

describe('commands/project/dev', () => {
  beforeEach(() => {
    // @ts-expect-error Mock implementation
    processExitSpy.mockImplementation(() => {});
    getProjectConfigSpy.mockResolvedValue({
      projectConfig: {
        name: 'test-project',
        srcDir: 'src',
        platformVersion: 'v2',
      },
      projectDir: '/test/project',
    });
    validateProjectConfigSpy.mockImplementation(() => {});
    isV2ProjectSpy.mockReturnValue(true);
    trackCommandUsageSpy.mockImplementation(async () => {});
    deprecatedProjectDevFlowSpy.mockResolvedValue(undefined);
    unifiedProjectDevFlowSpy.mockResolvedValue(undefined);
    getAllHsProfilesSpy.mockResolvedValue([]);
    listPromptSpy.mockResolvedValue('dev' as any);
    loadProfileSpy.mockReturnValue({
      accountId: 123456,
      variables: {},
    });
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectDevCommand.command).toEqual('dev');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(projectDevCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should be a function', () => {
      expect(typeof projectDevCommand.builder).toBe('function');
    });
  });

  describe('handler', () => {
    let args: ArgumentsCamelCase<ProjectDevArgs>;

    beforeEach(() => {
      args = {
        derivedAccountId: 123456,
      } as ArgumentsCamelCase<ProjectDevArgs>;
    });

    describe('validation', () => {
      it('should validate project config', async () => {
        await projectDevCommand.handler(args);

        expect(validateProjectConfigSpy).toHaveBeenCalledWith(
          {
            name: 'test-project',
            srcDir: 'src',
            platformVersion: 'v2',
          },
          '/test/project'
        );
      });

      it('should exit if project config validation fails', async () => {
        const error = new Error('Invalid config');
        validateProjectConfigSpy.mockImplementation(() => {
          throw error;
        });

        await projectDevCommand.handler(args);

        expect(logErrorSpy).toHaveBeenCalledWith(error);
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      });

      it('should exit if no project directory', async () => {
        getProjectConfigSpy.mockResolvedValue({
          projectConfig: {
            name: 'test-project',
            srcDir: 'src',
            platformVersion: 'v2',
          },
          projectDir: null,
        });

        // Make process.exit actually throw to stop execution
        processExitSpy.mockImplementation((code?: string | number | null) => {
          throw new Error(`process.exit called with ${code}`);
        });

        await expect(projectDevCommand.handler(args)).rejects.toThrow(
          'process.exit called'
        );

        expect(uiLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('project')
        );
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      });

      it('should error if using testingAccount and projectAccount with legacy project', async () => {
        isV2ProjectSpy.mockReturnValue(false);
        args.testingAccount = '111111';
        args.projectAccount = '222222';

        await projectDevCommand.handler(args);

        expect(logErrorSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining(
              '--project-account and --testing-account'
            ),
          })
        );
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      });

      it('should error if using account flag with V2 project', async () => {
        isV2ProjectSpy.mockReturnValue(true);
        args.userProvidedAccount = '123456';

        await projectDevCommand.handler(args);

        expect(logErrorSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('--account flag'),
          })
        );
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      });
    });

    describe('account resolution', () => {
      it('should use projectAccount flag', async () => {
        args.projectAccount = '999999';
        getConfigAccountIfExistsSpy.mockReturnValue({
          accountId: 999999,
        } as any);

        await projectDevCommand.handler(args);

        expect(getConfigAccountIfExistsSpy).toHaveBeenCalledWith('999999');
        expect(trackCommandUsageSpy).toHaveBeenCalledWith(
          'project-dev',
          { successful: true },
          999999
        );
      });

      it('should use userProvidedAccount for legacy projects', async () => {
        isV2ProjectSpy.mockReturnValue(false);
        args.userProvidedAccount = '888888';
        args.derivedAccountId = 888888;

        await projectDevCommand.handler(args);

        expect(trackCommandUsageSpy).toHaveBeenCalledWith(
          'project-dev',
          { successful: true },
          888888
        );
      });

      it('should use profile accountId when profile specified', async () => {
        args.profile = 'test-profile';
        loadAndValidateProfileSpy.mockReturnValue({
          accountId: 777777,
        } as any);

        await projectDevCommand.handler(args);

        expect(loadAndValidateProfileSpy).toHaveBeenCalledWith(
          {
            name: 'test-project',
            srcDir: 'src',
            platformVersion: 'v2',
          },
          '/test/project',
          'test-profile'
        );
        expect(trackCommandUsageSpy).toHaveBeenCalledWith(
          'project-dev',
          { successful: true },
          777777
        );
      });

      it('should exit if profile loading fails', async () => {
        args.profile = 'invalid-profile';
        const error = new Error('Profile not found');
        loadAndValidateProfileSpy.mockImplementation(() => {
          throw error;
        });
        // Make process.exit actually throw to stop execution
        processExitSpy.mockImplementation((code?: string | number | null) => {
          throw new Error(`process.exit called with ${code}`);
        });

        await expect(projectDevCommand.handler(args)).rejects.toThrow(
          'process.exit called'
        );

        expect(logErrorSpy).toHaveBeenCalledWith(error);
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      });

      it('should prompt for profile selection when profiles exist and no profile is specified', async () => {
        getAllHsProfilesSpy.mockResolvedValue(['dev', 'prod']);
        listPromptSpy.mockResolvedValue('dev' as any);
        loadProfileSpy.mockReturnValue({
          accountId: 123456,
          variables: {},
        });
        loadAndValidateProfileSpy.mockResolvedValue({
          accountId: 789012,
          variables: {},
        });

        await projectDevCommand.handler(args);

        expect(getAllHsProfilesSpy).toHaveBeenCalledWith('/test/project/src');
        expect(listPromptSpy).toHaveBeenCalledWith(expect.any(String), {
          choices: [
            { name: 'dev [123456]', value: 'dev' },
            { name: 'prod [123456]', value: 'prod' },
          ],
        });
        expect(loadAndValidateProfileSpy).toHaveBeenCalledWith(
          {
            name: 'test-project',
            srcDir: 'src',
            platformVersion: 'v2',
          },
          '/test/project',
          'dev'
        );
        expect(trackCommandUsageSpy).toHaveBeenCalledWith(
          'project-dev',
          { successful: true },
          789012
        );
      });

      it('should exit if profile loading fails after selection', async () => {
        getAllHsProfilesSpy.mockResolvedValue(['dev', 'prod']);
        listPromptSpy.mockResolvedValue('dev' as any);
        loadProfileSpy.mockReturnValue({
          accountId: 123456,
          variables: {},
        });
        const error = new Error('Failed to load profile');
        loadAndValidateProfileSpy.mockImplementation(() => {
          throw error;
        });

        // Make process.exit actually throw to stop execution
        processExitSpy.mockImplementation((code?: string | number | null) => {
          throw new Error(`process.exit called with ${code}`);
        });

        await expect(projectDevCommand.handler(args)).rejects.toThrow(
          'process.exit called'
        );

        expect(logErrorSpy).toHaveBeenCalledWith(error);
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      });

      it('should use derivedAccountId as fallback', async () => {
        await projectDevCommand.handler(args);

        expect(trackCommandUsageSpy).toHaveBeenCalledWith(
          'project-dev',
          { successful: true },
          123456
        );
      });
    });

    describe('dev flow execution', () => {
      it('should track command usage', async () => {
        await projectDevCommand.handler(args);

        expect(trackCommandUsageSpy).toHaveBeenCalledWith(
          'project-dev',
          { successful: true },
          123456
        );
      });

      it('should run unified flow for V2 projects', async () => {
        isV2ProjectSpy.mockReturnValue(true);

        await projectDevCommand.handler(args);

        expect(unifiedProjectDevFlowSpy).toHaveBeenCalledWith({
          args,
          targetProjectAccountId: 123456,
          providedTargetTestingAccountId: undefined,
          projectConfig: {
            name: 'test-project',
            srcDir: 'src',
            platformVersion: 'v2',
          },
          projectDir: '/test/project',
          profileConfig: undefined,
        });
        expect(deprecatedProjectDevFlowSpy).not.toHaveBeenCalled();
      });

      it('should run deprecated flow for legacy projects', async () => {
        isV2ProjectSpy.mockReturnValue(false);

        await projectDevCommand.handler(args);

        expect(deprecatedProjectDevFlowSpy).toHaveBeenCalledWith({
          args,
          accountId: 123456,
          projectConfig: {
            name: 'test-project',
            srcDir: 'src',
            platformVersion: 'v2',
          },
          projectDir: '/test/project',
        });
        expect(unifiedProjectDevFlowSpy).not.toHaveBeenCalled();
      });

      it('should pass testingAccount to unified flow', async () => {
        isV2ProjectSpy.mockReturnValue(true);
        args.testingAccount = '555555';
        getConfigAccountIfExistsSpy.mockReturnValue({
          accountId: 555555,
        } as any);

        await projectDevCommand.handler(args);

        expect(unifiedProjectDevFlowSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            providedTargetTestingAccountId: 555555,
          })
        );
      });

      it('should pass profile config to unified flow', async () => {
        args.profile = 'dev-profile';
        const profileConfig = { accountId: 666666 } as any;
        loadAndValidateProfileSpy.mockReturnValue(profileConfig);

        await projectDevCommand.handler(args);

        expect(unifiedProjectDevFlowSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            profileConfig,
          })
        );
      });
    });
  });
});

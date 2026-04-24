import path from 'path';
import { MockInstance, vi } from 'vitest';
import { ArgumentsCamelCase } from 'yargs';
import { validateSourceDirectory } from '../../../lib/projects/upload.js';
import {
  getProjectConfig,
  validateProjectConfig,
} from '../../../lib/projects/config.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { commands } from '../../../lang/en.js';
import { isLegacyProject } from '@hubspot/project-parsing-lib/projects';
import { validateProjectForProfile } from '../../../lib/projects/projectProfiles.js';
import { trackCommandUsage } from '../../../lib/usageTracking.js';
import { getConfigAccountById } from '@hubspot/local-dev-lib/config';
import { handleTranslate } from '../../../lib/projects/upload.js';
import { CommonArgs } from '../../../types/Yargs.js';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import projectValidateCommand from '../validate.js';
import { getAllHsProfiles } from '@hubspot/project-parsing-lib/profiles';
import SpinniesManager from '../../../lib/ui/SpinniesManager.js';
import { logError } from '../../../lib/errorHandlers/index.js';

type ProjectValidateArgs = CommonArgs & {
  profile?: string;
};

// Mock dependencies
vi.mock('../../../lib/projects/upload.js');
vi.mock('../../../lib/projects/config.js');
vi.mock('../../../lib/projects/projectProfiles.js');
vi.mock('../../../lib/errorHandlers/index.js');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('@hubspot/project-parsing-lib/projects');
vi.mock('@hubspot/project-parsing-lib/profiles');
vi.mock('../../../lib/ui/SpinniesManager.js');

describe('commands/project/validate', () => {
  const projectDir = '/test/project';
  let exitSpy: MockInstance;

  const mockProjectConfig = {
    name: 'test-project',
    srcDir: 'src',
    platformVersion: '2025.2',
  };

  const mockAccountConfig = {
    accountType: 'STANDARD',
    accountId: 123,
    env: 'prod',
  } as HubSpotConfigAccount;

  beforeEach(() => {
    // Mock process.exit to throw to stop execution
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(code => {
      throw new Error(`Process exited with code ${code}`);
    });

    // Set up default mocks
    vi.mocked(getConfigAccountById).mockReturnValue(mockAccountConfig);
    vi.mocked(trackCommandUsage);
    vi.mocked(SpinniesManager.init);
    vi.mocked(SpinniesManager.add);
    vi.mocked(SpinniesManager.succeed);
    vi.mocked(SpinniesManager.fail);
    vi.mocked(validateProjectForProfile).mockResolvedValue([]);
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  describe('project configuration validation', () => {
    it('should exit with error when project config is null', async () => {
      vi.mocked(getProjectConfig).mockResolvedValue({
        projectConfig: null,
        projectDir: null,
      });

      await expect(
        // @ts-expect-error partial mock
        projectValidateCommand.handler({
          derivedAccountId: 123,
          d: false,
          debug: false,
        })
      ).rejects.toThrow('Process exited with code 1');

      expect(uiLogger.error).toHaveBeenCalledWith(
        commands.project.validate.mustBeRanWithinAProject
      );
    });

    it('should exit with error when project directory is null', async () => {
      vi.mocked(getProjectConfig).mockResolvedValue({
        projectConfig: {
          name: 'test',
          srcDir: 'src',
          platformVersion: '2025.2',
        },
        projectDir: null,
      });

      await expect(
        // @ts-expect-error partial mock
        projectValidateCommand.handler({
          derivedAccountId: 123,
          d: false,
          debug: false,
        })
      ).rejects.toThrow('Process exited with code 1');

      expect(uiLogger.error).toHaveBeenCalledWith(
        commands.project.validate.mustBeRanWithinAProject
      );
    });

    it('should exit with error for non-V2 projects', async () => {
      vi.mocked(getProjectConfig).mockResolvedValue({
        projectConfig: {
          name: 'test',
          srcDir: 'src',
          platformVersion: '2024.1',
        },
        projectDir,
      });
      vi.mocked(isLegacyProject).mockReturnValue(true);

      await expect(
        // @ts-expect-error partial mock
        projectValidateCommand.handler({
          derivedAccountId: 123,
          d: false,
          debug: false,
        })
      ).rejects.toThrow('Process exited with code 1');

      expect(uiLogger.error).toHaveBeenCalledWith(
        commands.project.validate.badVersion
      );
    });

    it('should exit with error when validateProjectConfig throws', async () => {
      vi.mocked(getProjectConfig).mockResolvedValue({
        projectConfig: mockProjectConfig,
        projectDir,
      });
      vi.mocked(isLegacyProject).mockReturnValue(false);
      const error = new Error('Invalid project config');
      vi.mocked(validateProjectConfig).mockImplementation(() => {
        throw error;
      });

      await expect(
        // @ts-expect-error partial mock
        projectValidateCommand.handler({
          derivedAccountId: 123,
          d: false,
          debug: false,
        })
      ).rejects.toThrow('Process exited with code 1');

      expect(logError).toHaveBeenCalledWith(error);
    });
  });

  describe('profile validation', () => {
    describe('when a specific profile is provided', () => {
      it('should validate only the specified profile', async () => {
        vi.mocked(getProjectConfig).mockResolvedValue({
          projectConfig: mockProjectConfig,
          projectDir,
        });
        vi.mocked(isLegacyProject).mockReturnValue(false);
        vi.mocked(validateProjectConfig).mockReturnValue(undefined);
        vi.mocked(getAllHsProfiles).mockResolvedValue(['dev', 'prod', 'qa']);
        vi.mocked(validateProjectForProfile).mockResolvedValue([]);
        vi.mocked(validateSourceDirectory).mockResolvedValue(undefined);

        await expect(
          projectValidateCommand.handler({
            derivedAccountId: 123,
            profile: 'dev',
            d: false,
            debug: false,
          } as ArgumentsCamelCase<ProjectValidateArgs>)
        ).rejects.toThrow('Process exited with code 1');

        // Should call validateProjectForProfile for the specified profile
        expect(validateProjectForProfile).toHaveBeenCalledWith({
          projectConfig: mockProjectConfig,
          projectDir,
          profileName: 'dev',
          derivedAccountId: 123,
        });

        expect(uiLogger.success).toHaveBeenCalledWith(
          commands.project.validate.success(mockProjectConfig.name)
        );
      });

      it('should handle profile validation failure', async () => {
        vi.mocked(getProjectConfig).mockResolvedValue({
          projectConfig: mockProjectConfig,
          projectDir,
        });
        vi.mocked(isLegacyProject).mockReturnValue(false);
        vi.mocked(validateProjectConfig).mockReturnValue(undefined);
        vi.mocked(getAllHsProfiles).mockResolvedValue(['dev', 'prod']);
        const errorMessage = 'Profile not found';
        vi.mocked(validateProjectForProfile).mockResolvedValue([errorMessage]);

        await expect(
          projectValidateCommand.handler({
            derivedAccountId: 123,
            profile: 'dev',
            d: false,
            debug: false,
          } as ArgumentsCamelCase<ProjectValidateArgs>)
        ).rejects.toThrow('Process exited with code 1');

        // The error message is logged as a string
        expect(uiLogger.log).toHaveBeenCalledWith(errorMessage);
      });

      it('should handle translate failure for a profile', async () => {
        vi.mocked(getProjectConfig).mockResolvedValue({
          projectConfig: mockProjectConfig,
          projectDir,
        });
        vi.mocked(isLegacyProject).mockReturnValue(false);
        vi.mocked(validateProjectConfig).mockReturnValue(undefined);
        vi.mocked(getAllHsProfiles).mockResolvedValue(['dev', 'prod']);
        const error = new Error('Translation failed');
        vi.mocked(validateProjectForProfile).mockResolvedValue([
          commands.project.validate.failure('prod'),
          error,
        ]);

        await expect(
          projectValidateCommand.handler({
            derivedAccountId: 123,
            profile: 'dev',
            d: false,
            debug: false,
          } as ArgumentsCamelCase<ProjectValidateArgs>)
        ).rejects.toThrow('Process exited with code 1');

        // The error object is logged via logError
        expect(logError).toHaveBeenCalledWith(error);
      });
    });

    describe('when no profile is provided and project has profiles', () => {
      it('should validate all profiles', async () => {
        vi.mocked(getProjectConfig).mockResolvedValue({
          projectConfig: mockProjectConfig,
          projectDir,
        });
        vi.mocked(isLegacyProject).mockReturnValue(false);
        vi.mocked(validateProjectConfig).mockReturnValue(undefined);
        vi.mocked(getAllHsProfiles).mockResolvedValue(['dev', 'prod', 'qa']);
        vi.mocked(validateProjectForProfile).mockResolvedValue([]);
        vi.mocked(validateSourceDirectory).mockResolvedValue(undefined);

        await expect(
          projectValidateCommand.handler({
            derivedAccountId: 123,
            d: false,
            debug: false,
          } as ArgumentsCamelCase<ProjectValidateArgs>)
        ).rejects.toThrow('Process exited with code 1');

        // Should validate all three profiles
        expect(validateProjectForProfile).toHaveBeenCalledTimes(3);
        expect(validateProjectForProfile).toHaveBeenCalledWith({
          projectConfig: mockProjectConfig,
          projectDir,
          profileName: 'dev',
          derivedAccountId: 123,
          indentSpinners: true,
        });
        expect(validateProjectForProfile).toHaveBeenCalledWith({
          projectConfig: mockProjectConfig,
          projectDir,
          profileName: 'prod',
          derivedAccountId: 123,
          indentSpinners: true,
        });
        expect(validateProjectForProfile).toHaveBeenCalledWith({
          projectConfig: mockProjectConfig,
          projectDir,
          profileName: 'qa',
          derivedAccountId: 123,
          indentSpinners: true,
        });

        // Should show success for all profiles
        expect(SpinniesManager.succeed).toHaveBeenCalledWith(
          'validatingAllProfiles',
          expect.any(Object)
        );

        expect(uiLogger.success).toHaveBeenCalledWith(
          commands.project.validate.success(mockProjectConfig.name)
        );
      });

      it('should handle failure when validating multiple profiles', async () => {
        vi.mocked(getProjectConfig).mockResolvedValue({
          projectConfig: mockProjectConfig,
          projectDir,
        });
        vi.mocked(isLegacyProject).mockReturnValue(false);
        vi.mocked(validateProjectConfig).mockReturnValue(undefined);
        vi.mocked(getAllHsProfiles).mockResolvedValue(['dev', 'prod']);
        vi.mocked(validateProjectForProfile)
          .mockResolvedValueOnce([]) // dev succeeds
          .mockResolvedValueOnce(['Profile not found']); // prod fails

        await expect(
          projectValidateCommand.handler({
            derivedAccountId: 123,
            d: false,
            debug: false,
          } as ArgumentsCamelCase<ProjectValidateArgs>)
        ).rejects.toThrow('Process exited with code 1');

        expect(SpinniesManager.fail).toHaveBeenCalledWith(
          'validatingAllProfiles',
          expect.any(Object)
        );
      });

      it('should continue validating remaining profiles after one fails', async () => {
        vi.mocked(getProjectConfig).mockResolvedValue({
          projectConfig: mockProjectConfig,
          projectDir,
        });
        vi.mocked(isLegacyProject).mockReturnValue(false);
        vi.mocked(validateProjectConfig).mockReturnValue(undefined);
        vi.mocked(getAllHsProfiles).mockResolvedValue(['dev', 'prod', 'qa']);
        vi.mocked(validateProjectForProfile)
          .mockResolvedValueOnce([]) // dev succeeds
          .mockResolvedValueOnce(['Profile not found']) // prod fails
          .mockResolvedValueOnce([]); // qa succeeds
        vi.mocked(validateSourceDirectory).mockResolvedValue(undefined);

        await expect(
          projectValidateCommand.handler({
            derivedAccountId: 123,
            d: false,
            debug: false,
          } as ArgumentsCamelCase<ProjectValidateArgs>)
        ).rejects.toThrow('Process exited with code 1');

        // All three profiles should be attempted
        expect(validateProjectForProfile).toHaveBeenCalledTimes(3);
      });
    });

    describe('when no profile is provided and project has no profiles', () => {
      it('should validate without a profile', async () => {
        vi.mocked(getProjectConfig).mockResolvedValue({
          projectConfig: mockProjectConfig,
          projectDir,
        });
        vi.mocked(isLegacyProject).mockReturnValue(false);
        vi.mocked(validateProjectConfig).mockReturnValue(undefined);
        vi.mocked(getAllHsProfiles).mockResolvedValue([]);
        vi.mocked(handleTranslate).mockResolvedValue(undefined);
        vi.mocked(validateSourceDirectory).mockResolvedValue(undefined);

        await expect(
          projectValidateCommand.handler({
            derivedAccountId: 123,
            d: false,
            debug: false,
          } as ArgumentsCamelCase<ProjectValidateArgs>)
        ).rejects.toThrow('Process exited with code 1');

        // Should call handleTranslate without a profile
        expect(handleTranslate).toHaveBeenCalledWith({
          projectDir,
          projectConfig: mockProjectConfig,
          accountId: 123,
          skipValidation: false,
        });

        expect(uiLogger.success).toHaveBeenCalledWith(
          commands.project.validate.success(mockProjectConfig.name)
        );
      });

      it('should handle validation failure when no profiles exist', async () => {
        vi.mocked(getProjectConfig).mockResolvedValue({
          projectConfig: mockProjectConfig,
          projectDir,
        });
        vi.mocked(isLegacyProject).mockReturnValue(false);
        vi.mocked(validateProjectConfig).mockReturnValue(undefined);
        vi.mocked(getAllHsProfiles).mockResolvedValue([]);
        const error = new Error('Translation failed');
        vi.mocked(handleTranslate).mockRejectedValue(error);

        await expect(
          projectValidateCommand.handler({
            derivedAccountId: 123,
            d: false,
            debug: false,
          } as ArgumentsCamelCase<ProjectValidateArgs>)
        ).rejects.toThrow('Process exited with code 1');

        expect(uiLogger.error).toHaveBeenCalledWith(
          commands.project.validate.failure(mockProjectConfig.name)
        );
        expect(logError).toHaveBeenCalledWith(error);
      });
    });
  });

  describe('source directory validation', () => {
    it('should call validateSourceDirectory with correct parameters', async () => {
      vi.mocked(getProjectConfig).mockResolvedValue({
        projectConfig: mockProjectConfig,
        projectDir,
      });
      vi.mocked(isLegacyProject).mockReturnValue(false);
      vi.mocked(validateProjectConfig).mockReturnValue(undefined);
      vi.mocked(getAllHsProfiles).mockResolvedValue([]);
      vi.mocked(handleTranslate).mockResolvedValue(undefined);
      vi.mocked(validateSourceDirectory).mockResolvedValue(undefined);

      await expect(
        projectValidateCommand.handler({
          derivedAccountId: 123,
          d: false,
          debug: false,
        } as ArgumentsCamelCase<ProjectValidateArgs>)
      ).rejects.toThrow('Process exited with code 1');

      const expectedSrcDir = path.resolve(projectDir, mockProjectConfig.srcDir);
      expect(validateSourceDirectory).toHaveBeenCalledWith(
        expectedSrcDir,
        mockProjectConfig,
        projectDir
      );
    });

    it('should exit with error when validateSourceDirectory throws', async () => {
      vi.mocked(getProjectConfig).mockResolvedValue({
        projectConfig: mockProjectConfig,
        projectDir,
      });
      vi.mocked(isLegacyProject).mockReturnValue(false);
      vi.mocked(validateProjectConfig).mockReturnValue(undefined);
      vi.mocked(getAllHsProfiles).mockResolvedValue([]);
      vi.mocked(handleTranslate).mockResolvedValue(undefined);
      const error = new Error('Invalid source directory');
      vi.mocked(validateSourceDirectory).mockRejectedValue(error);

      await expect(
        projectValidateCommand.handler({
          derivedAccountId: 123,
          d: false,
          debug: false,
        } as ArgumentsCamelCase<ProjectValidateArgs>)
      ).rejects.toThrow('Process exited with code 1');

      expect(logError).toHaveBeenCalledWith(error);
    });
  });

  describe('command usage tracking', () => {
    it('should track command usage with account type', async () => {
      vi.mocked(getProjectConfig).mockResolvedValue({
        projectConfig: mockProjectConfig,
        projectDir,
      });
      vi.mocked(isLegacyProject).mockReturnValue(false);
      vi.mocked(validateProjectConfig).mockReturnValue(undefined);
      vi.mocked(getAllHsProfiles).mockResolvedValue([]);
      vi.mocked(handleTranslate).mockResolvedValue(undefined);
      vi.mocked(validateSourceDirectory).mockResolvedValue(undefined);

      await expect(
        projectValidateCommand.handler({
          derivedAccountId: 123,
          d: false,
          debug: false,
        } as ArgumentsCamelCase<ProjectValidateArgs>)
      ).rejects.toThrow('Process exited with code 1');

      expect(trackCommandUsage).toHaveBeenCalledWith(
        'project-validate',
        { type: 'STANDARD', successful: true },
        123
      );
    });
  });
});

import path from 'path';
import {
  loadHsProfileFile,
  getHsProfileFilename,
  getAllHsProfiles,
  validateProfileVariables,
  type HsProfileFile,
} from '@hubspot/project-parsing-lib/profiles';
import { ProjectConfig } from '../../../types/Projects.js';
import { lib } from '../../../lang/en.js';
import { uiBetaTag, uiLine } from '../../ui/index.js';
import { uiLogger } from '../../ui/logger.js';
import { getConfigAccountById } from '@hubspot/local-dev-lib/config';
import {
  logProfileHeader,
  logProfileFooter,
  loadProfile,
  enforceProfileUsage,
  loadAndValidateProfile,
  validateProjectForProfile,
} from '../projectProfiles.js';
import { Mock, Mocked } from 'vitest';
import { handleTranslate } from '../upload.js';
import SpinniesManager from '../../ui/SpinniesManager.js';
import { commands } from '../../../lang/en.js';

// Mock dependencies
vi.mock('@hubspot/project-parsing-lib/profiles');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../ui', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    uiBetaTag: vi.fn(),
    uiLine: vi.fn(),
    indent: vi.fn((level: number) => '  '.repeat(level)),
  };
});
vi.mock('../../../lang/en');
vi.mock('../upload');
vi.mock('../../ui/SpinniesManager');

const mockedLoadHsProfileFile = loadHsProfileFile as Mock;
const mockedGetHsProfileFilename = getHsProfileFilename as Mock;
const mockedGetAllHsProfiles = getAllHsProfiles as Mock;
const mockedValidateProfileVariables = validateProfileVariables as Mock;
const mockedGetConfigAccountById = getConfigAccountById as Mock;
const mockedUiBetaTag = uiBetaTag as Mock;
const mockedUiLine = uiLine as Mock;
const mockedUiLogger = uiLogger as Mocked<typeof uiLogger>;

describe('lib/projectProfiles', () => {
  describe('logProfileHeader()', () => {
    it('should log profile header with correct format', () => {
      const profileName = 'test-profile';
      const filename = 'test-profile.hsprofile';
      mockedGetHsProfileFilename.mockReturnValue(filename);

      logProfileHeader(profileName);

      expect(mockedUiLine).toHaveBeenCalled();
      expect(mockedUiBetaTag).toHaveBeenCalledWith(
        lib.projectProfiles.logs.usingProfile(filename)
      );
      expect(mockedUiLogger.log).toHaveBeenCalledWith('');
    });
  });

  describe('logProfileFooter()', () => {
    const mockProfile: HsProfileFile = {
      accountId: 123,
      variables: {
        key1: 'value1',
        key2: 'value2',
      },
    };

    it('should log profile footer with account ID', () => {
      logProfileFooter(mockProfile);

      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        lib.projectProfiles.logs.profileTargetAccount(mockProfile.accountId)
      );
      expect(mockedUiLine).toHaveBeenCalled();
      expect(mockedUiLogger.log).toHaveBeenCalledWith('');
    });

    it('should log variables when includeVariables is true', () => {
      logProfileFooter(mockProfile, true);

      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        lib.projectProfiles.logs.profileTargetAccount(mockProfile.accountId)
      );
      expect(mockedUiLogger.log).toHaveBeenCalledWith('');
      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        lib.projectProfiles.logs.profileVariables
      );
      expect(mockedUiLogger.log).toHaveBeenCalledWith('  key1: value1');
      expect(mockedUiLogger.log).toHaveBeenCalledWith('  key2: value2');
      expect(mockedUiLine).toHaveBeenCalled();
      expect(mockedUiLogger.log).toHaveBeenCalledWith('');
    });
  });

  describe('loadProfile()', () => {
    const mockProjectConfig: ProjectConfig = {
      srcDir: 'src',
      name: 'test-project',
      platformVersion: '1.0.0',
    };
    const mockProjectDir = '/test/project';
    const mockProfileName = 'test-profile';
    const mockProfile: HsProfileFile = {
      accountId: 123,
    };

    it('should throw error when project config is missing', () => {
      expect(() => loadProfile(null, mockProjectDir, mockProfileName)).toThrow(
        lib.projectProfiles.loadProfile.errors.noProjectConfig
      );
    });

    it('should throw error when project dir is missing', () => {
      expect(() =>
        loadProfile(mockProjectConfig, null, mockProfileName)
      ).toThrow(lib.projectProfiles.loadProfile.errors.noProjectConfig);
    });

    it('should throw error when profile is not found', () => {
      mockedLoadHsProfileFile.mockReturnValue(null);
      const filename = 'test-profile.hsprofile';
      mockedGetHsProfileFilename.mockReturnValue(filename);

      expect(() =>
        loadProfile(mockProjectConfig, mockProjectDir, mockProfileName)
      ).toThrow(
        lib.projectProfiles.loadProfile.errors.profileNotFound(filename)
      );
    });

    it('should throw error when profile has no account ID', () => {
      mockedLoadHsProfileFile.mockReturnValue({});
      const filename = 'test-profile.hsprofile';
      mockedGetHsProfileFilename.mockReturnValue(filename);

      expect(() =>
        loadProfile(mockProjectConfig, mockProjectDir, mockProfileName)
      ).toThrow(
        lib.projectProfiles.loadProfile.errors.missingAccountId(filename)
      );
    });

    it('should throw error when profile loading fails', () => {
      mockedLoadHsProfileFile.mockImplementation(() => {
        throw new Error('Load failed');
      });
      const filename = 'test-profile.hsprofile';
      mockedGetHsProfileFilename.mockReturnValue(filename);

      expect(() =>
        loadProfile(mockProjectConfig, mockProjectDir, mockProfileName)
      ).toThrow(
        lib.projectProfiles.loadProfile.errors.failedToLoadProfile(filename)
      );
    });

    it('should throw error when account is not found in config', () => {
      mockedLoadHsProfileFile.mockReturnValue(mockProfile);
      mockedGetConfigAccountById.mockImplementation(() => {
        throw new Error('Account not found');
      });
      const filename = 'test-profile.hsprofile';
      mockedGetHsProfileFilename.mockReturnValue(filename);

      expect(() =>
        loadProfile(mockProjectConfig, mockProjectDir, mockProfileName)
      ).toThrow(
        lib.projectProfiles.loadProfile.errors.listedAccountNotFound(
          mockProfile.accountId,
          filename
        )
      );
    });

    it('should return profile when loading succeeds', () => {
      mockedLoadHsProfileFile.mockReturnValue(mockProfile);
      mockedGetConfigAccountById.mockReturnValue({
        accountId: mockProfile.accountId,
      });

      const result = loadProfile(
        mockProjectConfig,
        mockProjectDir,
        mockProfileName
      );

      expect(result).toEqual(mockProfile);
      expect(mockedLoadHsProfileFile).toHaveBeenCalledWith(
        path.join(mockProjectDir, mockProjectConfig.srcDir),
        mockProfileName
      );
      expect(mockedGetConfigAccountById).toHaveBeenCalledWith(
        mockProfile.accountId
      );
    });
  });

  describe('enforceProfileUsage()', () => {
    const mockProjectConfig: ProjectConfig = {
      srcDir: 'src',
      name: 'test-project',
      platformVersion: '1.0.0',
    };
    const mockProjectDir = '/test/project';

    it('should not throw when no profiles exist', async () => {
      mockedGetAllHsProfiles.mockResolvedValue([]);

      await expect(
        enforceProfileUsage(mockProjectConfig, mockProjectDir)
      ).resolves.toBeUndefined();
    });

    it('should throw error when profiles exist', async () => {
      mockedGetAllHsProfiles.mockResolvedValue(['profile1', 'profile2']);

      await expect(
        enforceProfileUsage(mockProjectConfig, mockProjectDir)
      ).rejects.toThrow(
        lib.projectProfiles.exitIfUsingProfiles.errors.noProfileSpecified
      );
    });

    it('should not throw when project config is null', async () => {
      await expect(
        enforceProfileUsage(null, mockProjectDir)
      ).resolves.toBeUndefined();
    });

    it('should not throw when project dir is null', async () => {
      await expect(
        enforceProfileUsage(mockProjectConfig, null)
      ).resolves.toBeUndefined();
    });
  });

  describe('loadAndValidateProfile()', () => {
    const mockProjectConfig: ProjectConfig = {
      srcDir: 'src',
      name: 'test-project',
      platformVersion: '1.0.0',
    };
    const mockProjectDir = '/test/project';
    const mockProfileName = 'test-profile';
    const mockProfile: HsProfileFile = {
      accountId: 123,
      variables: {
        key1: 'value1',
        key2: 'value2',
      },
    };

    it('should enforce profile usage when no profile name provided', async () => {
      mockedGetAllHsProfiles.mockResolvedValue([]);

      const result = await loadAndValidateProfile(
        mockProjectConfig,
        mockProjectDir,
        undefined
      );

      expect(result).toBeUndefined();
      expect(mockedGetAllHsProfiles).toHaveBeenCalledWith(
        path.join(mockProjectDir, mockProjectConfig.srcDir)
      );
    });

    it('should throw when profiles exist but no profile name provided', async () => {
      mockedGetAllHsProfiles.mockResolvedValue(['profile1']);

      await expect(
        loadAndValidateProfile(mockProjectConfig, mockProjectDir, undefined)
      ).rejects.toThrow(
        lib.projectProfiles.exitIfUsingProfiles.errors.noProfileSpecified
      );
    });

    it('should load and return account ID when profile is valid', async () => {
      mockedLoadHsProfileFile.mockReturnValue(mockProfile);
      mockedGetConfigAccountById.mockReturnValue({
        accountId: mockProfile.accountId,
      });
      mockedGetHsProfileFilename.mockReturnValue('test-profile.hsprofile');
      mockedValidateProfileVariables.mockReturnValue({ success: true });

      const result = await loadAndValidateProfile(
        mockProjectConfig,
        mockProjectDir,
        mockProfileName
      );

      expect(result).toBe(mockProfile.accountId);
      expect(mockedLoadHsProfileFile).toHaveBeenCalledWith(
        path.join(mockProjectDir, mockProjectConfig.srcDir),
        mockProfileName
      );
      expect(mockedValidateProfileVariables).toHaveBeenCalledWith(
        mockProfile.variables,
        mockProfileName
      );
    });

    it('should log profile header and footer when not silent', async () => {
      mockedLoadHsProfileFile.mockReturnValue(mockProfile);
      mockedGetConfigAccountById.mockReturnValue({
        accountId: mockProfile.accountId,
      });
      mockedGetHsProfileFilename.mockReturnValue('test-profile.hsprofile');
      mockedValidateProfileVariables.mockReturnValue({ success: true });

      await loadAndValidateProfile(
        mockProjectConfig,
        mockProjectDir,
        mockProfileName,
        false
      );

      expect(mockedUiBetaTag).toHaveBeenCalled();
      expect(mockedUiLine).toHaveBeenCalled();
      expect(mockedUiLogger.log).toHaveBeenCalled();
    });

    it('should not log when silent is true', async () => {
      mockedLoadHsProfileFile.mockReturnValue(mockProfile);
      mockedGetConfigAccountById.mockReturnValue({
        accountId: mockProfile.accountId,
      });
      mockedValidateProfileVariables.mockReturnValue({ success: true });

      await loadAndValidateProfile(
        mockProjectConfig,
        mockProjectDir,
        mockProfileName,
        true
      );

      expect(mockedUiBetaTag).not.toHaveBeenCalled();
      expect(mockedUiLine).not.toHaveBeenCalled();
    });

    it('should throw error when profile variables are invalid', async () => {
      const invalidProfile: HsProfileFile = {
        accountId: 123,
        variables: {
          invalid: 'value',
        },
      };
      const validationErrors = ['Variable "invalid" is not allowed'];
      mockedLoadHsProfileFile.mockReturnValue(invalidProfile);
      mockedGetConfigAccountById.mockReturnValue({
        accountId: invalidProfile.accountId,
      });
      mockedGetHsProfileFilename.mockReturnValue('test-profile.hsprofile');
      mockedValidateProfileVariables.mockReturnValue({
        success: false,
        errors: validationErrors,
      });

      await expect(
        loadAndValidateProfile(
          mockProjectConfig,
          mockProjectDir,
          mockProfileName
        )
      ).rejects.toThrow(
        lib.projectProfiles.loadProfile.errors.profileNotValid(
          'test-profile.hsprofile',
          validationErrors
        )
      );
    });

    it('should not validate when profile has no variables', async () => {
      const profileWithoutVars: HsProfileFile = {
        accountId: 123,
      };
      mockedLoadHsProfileFile.mockReturnValue(profileWithoutVars);
      mockedGetConfigAccountById.mockReturnValue({
        accountId: profileWithoutVars.accountId,
      });
      mockedGetHsProfileFilename.mockReturnValue('test-profile.hsprofile');

      const result = await loadAndValidateProfile(
        mockProjectConfig,
        mockProjectDir,
        mockProfileName
      );

      expect(result).toBe(profileWithoutVars.accountId);
      expect(mockedValidateProfileVariables).not.toHaveBeenCalled();
    });
  });

  describe('validateProjectForProfile()', () => {
    const mockProjectConfig: ProjectConfig = {
      srcDir: 'src',
      name: 'test-project',
      platformVersion: '2025.2',
    };
    const mockProjectDir = '/test/project';
    const mockProfileName = 'test-profile';
    const mockDerivedAccountId = 123;
    const mockProfileFilename = 'test-profile.hsprofile';
    const mockProfile: HsProfileFile = {
      accountId: mockDerivedAccountId,
    };

    beforeEach(() => {
      mockedGetHsProfileFilename.mockReturnValue(mockProfileFilename);
      vi.mocked(SpinniesManager.init);
      vi.mocked(SpinniesManager.add);
      vi.mocked(SpinniesManager.succeed);
      vi.mocked(SpinniesManager.fail);

      // Mock dependencies for loadAndValidateProfile
      mockedGetAllHsProfiles.mockResolvedValue([]);
      mockedLoadHsProfileFile.mockReturnValue(mockProfile);
      mockedGetConfigAccountById.mockReturnValue({
        accountId: mockDerivedAccountId,
      });
      mockedValidateProfileVariables.mockReturnValue({ success: true });

      vi.mocked(handleTranslate).mockResolvedValue(undefined);
    });

    it('should return empty array when validation succeeds', async () => {
      const result = await validateProjectForProfile({
        projectConfig: mockProjectConfig,
        projectDir: mockProjectDir,
        profileName: mockProfileName,
        derivedAccountId: mockDerivedAccountId,
      });

      expect(result).toEqual([]);
      expect(SpinniesManager.add).toHaveBeenCalledWith(
        `validatingProfile-${mockProfileName}`,
        {
          text: commands.project.validate.spinners.validatingProfile(
            mockProfileFilename
          ),
          indent: 0,
        }
      );
      expect(SpinniesManager.succeed).toHaveBeenCalledWith(
        `validatingProfile-${mockProfileName}`,
        {
          text: commands.project.validate.spinners.profileValidationSucceeded(
            mockProfileFilename
          ),
          succeedColor: 'white',
        }
      );
    });

    it('should call handleTranslate with profile account ID from profile', async () => {
      await validateProjectForProfile({
        projectConfig: mockProjectConfig,
        projectDir: mockProjectDir,
        profileName: mockProfileName,
        derivedAccountId: mockDerivedAccountId,
      });

      expect(handleTranslate).toHaveBeenCalledWith({
        projectDir: mockProjectDir,
        projectConfig: mockProjectConfig,
        accountId: mockDerivedAccountId,
        skipValidation: false,
        profile: mockProfileName,
        includeTranslationErrorMessage: false,
      });
    });

    it('should call handleTranslate with different profile account ID when profile has different ID', async () => {
      const profileAccountId = 456;
      const profileWithDifferentId: HsProfileFile = {
        accountId: profileAccountId,
      };
      mockedLoadHsProfileFile.mockReturnValue(profileWithDifferentId);
      mockedGetConfigAccountById.mockReturnValue({
        accountId: profileAccountId,
      });

      await validateProjectForProfile({
        projectConfig: mockProjectConfig,
        projectDir: mockProjectDir,
        profileName: mockProfileName,
        derivedAccountId: mockDerivedAccountId,
      });

      expect(handleTranslate).toHaveBeenCalledWith({
        projectDir: mockProjectDir,
        projectConfig: mockProjectConfig,
        accountId: profileAccountId,
        skipValidation: false,
        profile: mockProfileName,
        includeTranslationErrorMessage: false,
      });
    });

    it('should return error when profile has no accountId', async () => {
      // @ts-expect-error causing an error on purpose
      const profileWithoutId: HsProfileFile = {};
      mockedLoadHsProfileFile.mockReturnValue(profileWithoutId);

      const result = await validateProjectForProfile({
        projectConfig: mockProjectConfig,
        projectDir: mockProjectDir,
        profileName: mockProfileName,
        derivedAccountId: mockDerivedAccountId,
      });

      expect(result.length).toBeGreaterThan(0);
      expect(SpinniesManager.fail).toHaveBeenCalled();
      expect(handleTranslate).not.toHaveBeenCalled();
    });

    it('should indent spinners when indentSpinners is true', async () => {
      await validateProjectForProfile({
        projectConfig: mockProjectConfig,
        projectDir: mockProjectDir,
        profileName: mockProfileName,
        derivedAccountId: mockDerivedAccountId,
        indentSpinners: true,
      });

      expect(SpinniesManager.add).toHaveBeenCalledWith(
        `validatingProfile-${mockProfileName}`,
        {
          text: commands.project.validate.spinners.validatingProfile(
            mockProfileFilename
          ),
          indent: 2,
        }
      );
    });

    it('should not indent spinners when indentSpinners is false', async () => {
      await validateProjectForProfile({
        projectConfig: mockProjectConfig,
        projectDir: mockProjectDir,
        profileName: mockProfileName,
        derivedAccountId: mockDerivedAccountId,
        indentSpinners: false,
      });

      expect(SpinniesManager.add).toHaveBeenCalledWith(
        `validatingProfile-${mockProfileName}`,
        {
          text: commands.project.validate.spinners.validatingProfile(
            mockProfileFilename
          ),
          indent: 0,
        }
      );
    });

    it('should return error array when profile loading fails', async () => {
      mockedLoadHsProfileFile.mockReturnValue(null);

      const result = await validateProjectForProfile({
        projectConfig: mockProjectConfig,
        projectDir: mockProjectDir,
        profileName: mockProfileName,
        derivedAccountId: mockDerivedAccountId,
      });

      expect(result.length).toBeGreaterThan(0);
      expect(SpinniesManager.fail).toHaveBeenCalledWith(
        `validatingProfile-${mockProfileName}`,
        {
          text: commands.project.validate.spinners.profileValidationFailed(
            mockProfileFilename
          ),
          failColor: 'white',
        }
      );
      expect(handleTranslate).not.toHaveBeenCalled();
    });

    it('should return error when profile file loading throws', async () => {
      mockedLoadHsProfileFile.mockImplementation(() => {
        throw new Error('Failed to load profile file');
      });

      const result = await validateProjectForProfile({
        projectConfig: mockProjectConfig,
        projectDir: mockProjectDir,
        profileName: mockProfileName,
        derivedAccountId: mockDerivedAccountId,
      });

      expect(result.length).toBeGreaterThan(0);
      expect(SpinniesManager.fail).toHaveBeenCalledWith(
        `validatingProfile-${mockProfileName}`,
        {
          text: commands.project.validate.spinners.profileValidationFailed(
            mockProfileFilename
          ),
          failColor: 'white',
        }
      );
      expect(handleTranslate).not.toHaveBeenCalled();
    });

    it('should return error array when translation fails', async () => {
      const error = new Error('Translation failed');
      vi.mocked(handleTranslate).mockRejectedValue(error);

      const result = await validateProjectForProfile({
        projectConfig: mockProjectConfig,
        projectDir: mockProjectDir,
        profileName: mockProfileName,
        derivedAccountId: mockDerivedAccountId,
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(
        commands.project.validate.failureWithProfile(mockProfileName)
      );
      expect(result[1]).toBe(`  ${error.message}\n`);
      expect(SpinniesManager.fail).toHaveBeenCalledWith(
        `validatingProfile-${mockProfileName}`,
        {
          text: commands.project.validate.spinners.invalidWithProfile(
            mockProfileName
          ),
          failColor: 'white',
        }
      );
    });

    it('should return string error when translation fails with non-Error', async () => {
      const error = 'Translation error';
      vi.mocked(handleTranslate).mockRejectedValue(error);

      const result = await validateProjectForProfile({
        projectConfig: mockProjectConfig,
        projectDir: mockProjectDir,
        profileName: mockProfileName,
        derivedAccountId: mockDerivedAccountId,
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(
        commands.project.validate.failureWithProfile(mockProfileName)
      );
      expect(result[1]).toBe(`  ${error}\n`);
    });

    it('should use correct spinner name based on profile name', async () => {
      const customProfileName = 'custom-profile';

      await validateProjectForProfile({
        projectConfig: mockProjectConfig,
        projectDir: mockProjectDir,
        profileName: customProfileName,
        derivedAccountId: mockDerivedAccountId,
      });

      expect(SpinniesManager.add).toHaveBeenCalledWith(
        `validatingProfile-${customProfileName}`,
        expect.any(Object)
      );
      expect(SpinniesManager.succeed).toHaveBeenCalledWith(
        `validatingProfile-${customProfileName}`,
        expect.any(Object)
      );
    });
  });
});

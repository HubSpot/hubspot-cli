import path from 'path';
import {
  loadHsProfileFile,
  getHsProfileFilename,
  getAllHsProfiles,
} from '@hubspot/project-parsing-lib';
import { HsProfileFile } from '@hubspot/project-parsing-lib/src/lib/types';
import { ProjectConfig } from '../../types/Projects';
import { lib } from '../../lang/en';
import { uiBetaTag, uiLine } from '../ui';
import { uiLogger } from '../ui/logger';
import { EXIT_CODES } from '../enums/exitCodes';
import {
  logProfileHeader,
  logProfileFooter,
  loadProfile,
  exitIfUsingProfiles,
} from '../projectProfiles';

// Mock dependencies
jest.mock('@hubspot/project-parsing-lib');
jest.mock('../ui');
jest.mock('../ui/logger');
jest.mock('../../lang/en');

// Mock process.exit
const mockExit = jest.spyOn(process, 'exit').mockImplementation(code => {
  throw new Error(`Process.exit called with code ${code}`);
});

const mockedLoadHsProfileFile = loadHsProfileFile as jest.Mock;
const mockedGetHsProfileFilename = getHsProfileFilename as jest.Mock;
const mockedGetAllHsProfiles = getAllHsProfiles as jest.Mock;
const mockedUiBetaTag = uiBetaTag as jest.Mock;
const mockedUiLine = uiLine as jest.Mock;
const mockedUiLogger = uiLogger as jest.Mocked<typeof uiLogger>;

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

    it('should return undefined when project config is missing', () => {
      const result = loadProfile(null, mockProjectDir, mockProfileName);

      expect(result).toBeUndefined();
      expect(mockedUiLogger.error).toHaveBeenCalledWith(
        lib.projectProfiles.loadProfile.errors.noProjectConfig
      );
    });

    it('should return undefined when profile is not found', () => {
      mockedLoadHsProfileFile.mockReturnValue(null);
      const filename = 'test-profile.hsprofile';
      mockedGetHsProfileFilename.mockReturnValue(filename);

      const result = loadProfile(
        mockProjectConfig,
        mockProjectDir,
        mockProfileName
      );

      expect(result).toBeUndefined();
      expect(mockedUiLogger.error).toHaveBeenCalledWith(
        lib.projectProfiles.loadProfile.errors.profileNotFound(filename)
      );
    });

    it('should return undefined when profile has no account ID', () => {
      mockedLoadHsProfileFile.mockReturnValue({});
      const filename = 'test-profile.hsprofile';
      mockedGetHsProfileFilename.mockReturnValue(filename);

      const result = loadProfile(
        mockProjectConfig,
        mockProjectDir,
        mockProfileName
      );

      expect(result).toBeUndefined();
      expect(mockedUiLogger.error).toHaveBeenCalledWith(
        lib.projectProfiles.loadProfile.errors.missingAccountId(filename)
      );
    });

    it('should return undefined when profile loading fails', () => {
      mockedLoadHsProfileFile.mockImplementation(() => {
        throw new Error('Load failed');
      });
      const filename = 'test-profile.hsprofile';
      mockedGetHsProfileFilename.mockReturnValue(filename);

      const result = loadProfile(
        mockProjectConfig,
        mockProjectDir,
        mockProfileName
      );

      expect(result).toBeUndefined();
      expect(mockedUiLogger.error).toHaveBeenCalledWith(
        lib.projectProfiles.loadProfile.errors.failedToLoadProfile(filename)
      );
    });

    it('should return profile when loading succeeds', () => {
      mockedLoadHsProfileFile.mockReturnValue(mockProfile);

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
    });
  });

  describe('exitIfUsingProfiles()', () => {
    const mockProjectConfig: ProjectConfig = {
      srcDir: 'src',
      name: 'test-project',
      platformVersion: '1.0.0',
    };
    const mockProjectDir = '/test/project';

    it('should not exit when no profiles exist', async () => {
      mockedGetAllHsProfiles.mockResolvedValue([]);

      await exitIfUsingProfiles(mockProjectConfig, mockProjectDir);

      expect(mockedUiLogger.error).not.toHaveBeenCalled();
      expect(mockExit).not.toHaveBeenCalled();
    });

    it('should exit with error when profiles exist', async () => {
      mockedGetAllHsProfiles.mockResolvedValue(['profile1', 'profile2']);

      await expect(
        exitIfUsingProfiles(mockProjectConfig, mockProjectDir)
      ).rejects.toThrow(`Process.exit called with code ${EXIT_CODES.ERROR}`);

      expect(mockedUiLogger.error).toHaveBeenCalledWith(
        lib.projectProfiles.exitIfUsingProfiles.errors.noProfileSpecified
      );
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });
});

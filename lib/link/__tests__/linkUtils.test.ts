import { describe, it, expect, vi, Mock } from 'vitest';
import { localConfigFileExists } from '@hubspot/local-dev-lib/config';
import {
  getHsSettingsFileIfExists,
  writeHsSettingsFile,
} from '@hubspot/local-dev-lib/config/hsSettings';
import { uiLogger } from '../../ui/logger.js';
import {
  addAccountToLinkedSettings,
  hasDeprecatedConfigConflict,
  isDirectoryLinked,
  writeLinkedSettings,
} from '../linkUtils.js';

vi.mock('@hubspot/local-dev-lib/config');
vi.mock('@hubspot/local-dev-lib/config/hsSettings');
vi.mock('../../errorHandlers/index.js');

const mockedLocalConfigFileExists = localConfigFileExists as Mock;
const mockedGetHsSettingsFileIfExists = getHsSettingsFileIfExists as Mock;
const mockedWriteHsSettingsFile = writeHsSettingsFile as Mock;

describe('lib/link/linkUtils', () => {
  describe('isDirectoryLinked()', () => {
    it('should return false when settings is null', () => {
      expect(isDirectoryLinked(null)).toBe(false);
    });

    it('should return false when accounts array is empty', () => {
      expect(
        isDirectoryLinked({ accounts: [], localDefaultAccount: undefined })
      ).toBe(false);
    });

    it('should return true when accounts exist', () => {
      expect(
        isDirectoryLinked({ accounts: [111], localDefaultAccount: 111 })
      ).toBe(true);
    });
  });

  describe('hasDeprecatedConfigConflict()', () => {
    it('should return true and log error when deprecated config exists', () => {
      mockedLocalConfigFileExists.mockReturnValue(true);

      expect(hasDeprecatedConfigConflict(['account', 'link'])).toBe(true);
      expect(uiLogger.error).toHaveBeenCalledTimes(1);
    });

    it('should return false when no deprecated config exists', () => {
      mockedLocalConfigFileExists.mockReturnValue(false);

      expect(hasDeprecatedConfigConflict(['account', 'link'])).toBe(false);
      expect(uiLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('writeLinkedSettings()', () => {
    it('should return true on successful write', () => {
      mockedWriteHsSettingsFile.mockImplementation(() => {});

      const settings = { accounts: [111], localDefaultAccount: 111 };
      expect(writeLinkedSettings(settings, '.hs/settings.json')).toBe(true);
      expect(mockedWriteHsSettingsFile).toHaveBeenCalledWith(settings);
    });

    it('should return false and log error when write throws', () => {
      mockedWriteHsSettingsFile.mockImplementation(() => {
        throw new Error('disk full');
      });

      const settings = { accounts: [111], localDefaultAccount: 111 };
      expect(writeLinkedSettings(settings, '.hs/settings.json')).toBe(false);
      expect(uiLogger.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('addAccountToLinkedSettings()', () => {
    beforeEach(() => {
      mockedLocalConfigFileExists.mockReturnValue(false);
      mockedWriteHsSettingsFile.mockImplementation(() => {});
    });

    it('should do nothing when no settings file exists', () => {
      mockedGetHsSettingsFileIfExists.mockReturnValue(null);

      addAccountToLinkedSettings(222);

      expect(mockedWriteHsSettingsFile).not.toHaveBeenCalled();
    });

    it('should do nothing when settings has no accounts', () => {
      mockedGetHsSettingsFileIfExists.mockReturnValue({
        accounts: [],
        localDefaultAccount: undefined,
      });

      addAccountToLinkedSettings(222);

      expect(mockedWriteHsSettingsFile).not.toHaveBeenCalled();
    });

    it('should do nothing when account is already linked', () => {
      mockedGetHsSettingsFileIfExists.mockReturnValue({
        accounts: [111, 222],
        localDefaultAccount: 111,
      });

      addAccountToLinkedSettings(222);

      expect(mockedWriteHsSettingsFile).not.toHaveBeenCalled();
    });

    it('should write updated settings with the new account', () => {
      mockedGetHsSettingsFileIfExists.mockReturnValue({
        accounts: [111],
        localDefaultAccount: 111,
      });

      addAccountToLinkedSettings(222);

      expect(mockedWriteHsSettingsFile).toHaveBeenCalledWith({
        accounts: [111, 222],
        localDefaultAccount: 111,
      });
      expect(uiLogger.info).toHaveBeenCalledTimes(1);
    });

    it('should do nothing when local config exists', () => {
      mockedLocalConfigFileExists.mockReturnValue(true);
      mockedGetHsSettingsFileIfExists.mockReturnValue({
        accounts: [111],
        localDefaultAccount: 111,
      });

      addAccountToLinkedSettings(222);

      expect(mockedWriteHsSettingsFile).not.toHaveBeenCalled();
    });

    it('should log failure and debug error when write throws', () => {
      mockedGetHsSettingsFileIfExists.mockReturnValue({
        accounts: [111],
        localDefaultAccount: 111,
      });
      mockedWriteHsSettingsFile.mockImplementation(() => {
        throw new Error('disk full');
      });

      addAccountToLinkedSettings(222);

      expect(uiLogger.warn).toHaveBeenCalledTimes(1);
    });
  });
});

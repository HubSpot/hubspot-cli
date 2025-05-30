import { trackUsage } from '@hubspot/local-dev-lib/trackUsage';
import {
  isTrackingAllowed,
  getAccountConfig,
} from '@hubspot/local-dev-lib/config';
import { API_KEY_AUTH_METHOD } from '@hubspot/local-dev-lib/constants/auth';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  trackCommandUsage,
  trackHelpUsage,
  trackConvertFieldsUsage,
  trackAuthAction,
  trackCommandMetadataUsage,
} from '../usageTracking';
import { version } from '../../package.json';

jest.mock('@hubspot/local-dev-lib/trackUsage');
jest.mock('@hubspot/local-dev-lib/config');
jest.mock('@hubspot/local-dev-lib/logger');

const mockedTrackUsage = trackUsage as jest.Mock;
const mockedIsTrackingAllowed = isTrackingAllowed as jest.Mock;
const mockedGetAccountConfig = getAccountConfig as jest.Mock;
const mockedLogger = logger as jest.Mocked<typeof logger>;

describe('lib/usageTracking', () => {
  const mockPlatform = 'darwin';
  const mockNodeVersion = 'v16.14.0';

  beforeEach(() => {
    mockedIsTrackingAllowed.mockReturnValue(true);
    Object.defineProperty(process, 'platform', { value: mockPlatform });
    Object.defineProperty(process, 'version', { value: mockNodeVersion });
  });

  describe('trackCommandUsage()', () => {
    const mockCommand = 'test-command';
    const mockAccountId = 123;

    it('should not track when tracking is disabled', async () => {
      mockedIsTrackingAllowed.mockReturnValue(false);

      await trackCommandUsage(mockCommand);

      expect(mockedTrackUsage).not.toHaveBeenCalled();
    });

    it('should track command usage with default auth type', async () => {
      await trackCommandUsage(mockCommand, {}, mockAccountId);

      // Allow setImmediate to execute
      await new Promise(resolve => setImmediate(resolve));

      expect(mockedTrackUsage).toHaveBeenCalledWith(
        'cli-interaction',
        'INTERACTION',
        expect.objectContaining({
          action: 'cli-command',
          command: mockCommand,
          os: 'macos',
          nodeVersion: mockNodeVersion,
          nodeMajorVersion: 'v16',
          version,
          authType: API_KEY_AUTH_METHOD.value,
        }),
        mockAccountId
      );
    });

    it('should track command usage with custom auth type', async () => {
      mockedGetAccountConfig.mockReturnValue({ authType: 'oauth2' });

      await trackCommandUsage(mockCommand, {}, mockAccountId);

      // Allow setImmediate to execute
      await new Promise(resolve => setImmediate(resolve));

      expect(mockedTrackUsage).toHaveBeenCalledWith(
        'cli-interaction',
        'INTERACTION',
        expect.objectContaining({
          authType: 'oauth2',
        }),
        mockAccountId
      );
    });

    it('should handle tracking errors gracefully', async () => {
      const error = new Error('Tracking failed');
      mockedTrackUsage.mockRejectedValue(error);

      await trackCommandUsage(mockCommand);

      // Allow setImmediate to execute
      await new Promise(resolve => setImmediate(resolve));

      expect(mockedLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(error.message)
      );
    });
  });

  describe('trackHelpUsage()', () => {
    const mockCommand = 'help-command';

    it('should not track when tracking is disabled', async () => {
      mockedIsTrackingAllowed.mockReturnValue(false);

      await trackHelpUsage(mockCommand);

      expect(mockedTrackUsage).not.toHaveBeenCalled();
    });

    it('should track help usage with command', async () => {
      await trackHelpUsage(mockCommand);

      expect(mockedTrackUsage).toHaveBeenCalledWith(
        'cli-interaction',
        'INTERACTION',
        expect.objectContaining({
          action: 'cli-help',
          command: mockCommand,
          os: 'macos',
          nodeVersion: mockNodeVersion,
          nodeMajorVersion: 'v16',
          version,
        })
      );
    });

    it('should track main help usage without command', async () => {
      await trackHelpUsage('');

      expect(mockedLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('main command')
      );
    });
  });

  describe('trackConvertFieldsUsage()', () => {
    const mockCommand = 'convert-fields-command';

    it('should not track when tracking is disabled', async () => {
      mockedIsTrackingAllowed.mockReturnValue(false);

      await trackConvertFieldsUsage(mockCommand);

      expect(mockedTrackUsage).not.toHaveBeenCalled();
    });

    it('should track convert fields usage', async () => {
      await trackConvertFieldsUsage(mockCommand);

      expect(mockedTrackUsage).toHaveBeenCalledWith(
        'cli-interaction',
        'INTERACTION',
        expect.objectContaining({
          action: 'cli-process-fields',
          command: mockCommand,
          os: 'macos',
          nodeVersion: mockNodeVersion,
          nodeMajorVersion: 'v16',
          version,
        })
      );
    });
  });

  describe('trackAuthAction()', () => {
    const mockCommand = 'auth-command';
    const mockAuthType = 'oauth2';
    const mockStep = 'init';
    const mockAccountId = 123;

    it('should not track when tracking is disabled', async () => {
      mockedIsTrackingAllowed.mockReturnValue(false);

      await trackAuthAction(mockCommand, mockAuthType, mockStep, mockAccountId);

      expect(mockedTrackUsage).not.toHaveBeenCalled();
    });

    it('should track auth action', async () => {
      await trackAuthAction(mockCommand, mockAuthType, mockStep, mockAccountId);

      expect(mockedTrackUsage).toHaveBeenCalledWith(
        'cli-interaction',
        'INTERACTION',
        expect.objectContaining({
          action: 'cli-auth',
          command: mockCommand,
          authType: mockAuthType,
          step: mockStep,
          os: 'macos',
          nodeVersion: mockNodeVersion,
          nodeMajorVersion: 'v16',
          version,
        }),
        mockAccountId
      );
    });
  });

  describe('trackCommandMetadataUsage()', () => {
    const mockCommand = 'metadata-command';
    const mockMeta = { assetType: 'test-asset' };
    const mockAccountId = 123;

    it('should not track when tracking is disabled', async () => {
      mockedIsTrackingAllowed.mockReturnValue(false);

      await trackCommandMetadataUsage(mockCommand, mockMeta, mockAccountId);

      expect(mockedTrackUsage).not.toHaveBeenCalled();
    });

    it('should track command metadata usage', async () => {
      await trackCommandMetadataUsage(mockCommand, mockMeta, mockAccountId);

      // Allow setImmediate to execute
      await new Promise(resolve => setImmediate(resolve));

      expect(mockedTrackUsage).toHaveBeenCalledWith(
        'cli-interaction',
        'INTERACTION',
        expect.objectContaining({
          action: 'cli-command-metadata',
          command: mockCommand,
          assetType: 'test-asset',
          os: 'macos',
          nodeVersion: mockNodeVersion,
          nodeMajorVersion: 'v16',
          version,
        }),
        mockAccountId
      );
    });
  });

  describe('Platform detection', () => {
    it('should return "macos" for darwin platform', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      await trackHelpUsage('test');

      expect(mockedTrackUsage).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ os: 'macos' })
      );
    });

    it('should return "windows" for win32 platform', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });

      await trackHelpUsage('test');

      expect(mockedTrackUsage).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ os: 'windows' })
      );
    });

    it('should return platform name for other platforms', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });

      await trackHelpUsage('test');

      expect(mockedTrackUsage).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ os: 'linux' })
      );
    });
  });
});

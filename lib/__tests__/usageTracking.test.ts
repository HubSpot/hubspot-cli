import {
  getConfig,
  getConfigAccountById,
  getConfigFilePath,
  getGlobalConfigFilePath,
} from '@hubspot/local-dev-lib/config';
import {
  API_KEY_AUTH_METHOD,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} from '@hubspot/local-dev-lib/constants/auth';
import { getAccessToken } from '@hubspot/local-dev-lib/personalAccessKey';
import { uiLogger } from '../ui/logger.js';
import {
  trackCommandUsage,
  trackHelpUsage,
  trackConvertFieldsUsage,
  trackAuthAction,
  trackCommandMetadataUsage,
  trackMcpPromotionShown,
} from '../usageTracking.js';
import { sendUsageEvent } from '../api/usageTracking.js';
import { pkg } from '../jsonLoader.js';
import { Mock, Mocked } from 'vitest';

const version = pkg.version;

// Unmock the usageTracking module for this test file
vi.unmock('../usageTracking.js');

vi.mock('../api/usageTracking.js');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('@hubspot/local-dev-lib/personalAccessKey');

const mockedSendUsageEvent = sendUsageEvent as Mock;
const mockedGetConfig = getConfig as Mock;
const mockedGetConfigAccountById = getConfigAccountById as Mock;
const mockedGetConfigFilePath = getConfigFilePath as Mock;
const mockedGetGlobalConfigFilePath = getGlobalConfigFilePath as Mock;
const mockedGetAccessToken = getAccessToken as Mock;
const mockedUiLogger = uiLogger as Mocked<typeof uiLogger>;

describe('lib/usageTracking', () => {
  const mockPlatform = 'darwin';
  const mockNodeVersion = 'v16.14.0';

  beforeEach(() => {
    mockedGetConfig.mockReturnValue({ allowUsageTracking: true });
    mockedGetConfigFilePath.mockReturnValue('/some/local/hubspot.config.yml');
    mockedGetGlobalConfigFilePath.mockReturnValue(
      '/Users/test/.hubspot/config.yml'
    );
    Object.defineProperty(process, 'platform', { value: mockPlatform });
    Object.defineProperty(process, 'version', { value: mockNodeVersion });
    delete process.env.DISABLE_USAGE_TRACKING;
    delete process.env.CI;
    delete process.env.HUBSPOT_MCP_AI_AGENT;
  });

  afterEach(() => {
    delete process.env.DISABLE_USAGE_TRACKING;
    delete process.env.CI;
    delete process.env.HUBSPOT_MCP_AI_AGENT;
  });

  describe('trackCommandUsage()', () => {
    const mockCommand = 'test-command';
    const mockAccountId = 123;

    it('should not track when tracking is disabled via config', async () => {
      mockedGetConfig.mockReturnValue({ allowUsageTracking: false });

      await trackCommandUsage(mockCommand);

      expect(mockedSendUsageEvent).not.toHaveBeenCalled();
    });

    it('should not track when --disable-usage-tracking flag is set', async () => {
      process.env.DISABLE_USAGE_TRACKING = 'true';

      await trackCommandUsage(mockCommand, {}, mockAccountId);

      expect(mockedSendUsageEvent).not.toHaveBeenCalled();
      expect(mockedUiLogger.debug).toHaveBeenCalledWith(
        'Usage tracking is disabled via the --disable-usage-tracking flag, not sending usage events'
      );
    });

    it('should track command usage with default auth type', async () => {
      await trackCommandUsage(mockCommand, {}, mockAccountId);

      expect(mockedSendUsageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'cli-interaction',
          eventClass: 'INTERACTION',
          accountId: mockAccountId,
          meta: expect.objectContaining({
            action: 'cli-command',
            command: mockCommand,
            os: 'macos',
            nodeVersion: mockNodeVersion,
            nodeMajorVersion: 'v16',
            version,
            authType: API_KEY_AUTH_METHOD.value,
          }),
        })
      );
    });

    it('should track command usage with custom auth type', async () => {
      mockedGetConfigAccountById.mockReturnValue({ authType: 'oauth2' });

      await trackCommandUsage(mockCommand, {}, mockAccountId);

      expect(mockedSendUsageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            authType: 'oauth2',
          }),
        })
      );
    });

    it('should track command usage with userId for personal access key accounts', async () => {
      mockedGetConfigAccountById.mockReturnValue({
        accountId: mockAccountId,
        authType: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
        env: 'prod',
        personalAccessKey: 'test-key',
        auth: { tokenInfo: { accessToken: 'test-token' } },
      });
      mockedGetAccessToken.mockResolvedValue({
        userId: 456,
      });

      await trackCommandUsage(mockCommand, {}, mockAccountId);

      expect(mockedGetAccessToken).toHaveBeenCalledWith(
        'test-key',
        'prod',
        mockAccountId
      );
      expect(mockedSendUsageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: mockAccountId,
          userId: 456,
        })
      );
    });

    it('should not fetch userId for non-personal access key accounts', async () => {
      mockedGetConfigAccountById.mockReturnValue({ authType: 'oauth2' });

      await trackCommandUsage(mockCommand, {}, mockAccountId);

      expect(mockedGetAccessToken).not.toHaveBeenCalled();
      expect(mockedSendUsageEvent).toHaveBeenCalledWith(
        expect.not.objectContaining({
          userId: expect.any(Number),
        })
      );
    });

    it('should send command usage without userId when userId lookup fails', async () => {
      mockedGetConfigAccountById.mockReturnValue({
        accountId: mockAccountId,
        authType: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
        env: 'prod',
        personalAccessKey: 'test-key',
        auth: { tokenInfo: { accessToken: 'test-token' } },
      });
      mockedGetAccessToken.mockRejectedValueOnce(
        new Error('token info failed')
      );

      await trackCommandUsage(mockCommand, {}, mockAccountId);

      expect(mockedSendUsageEvent).toHaveBeenCalledWith(
        expect.not.objectContaining({
          userId: expect.any(Number),
        })
      );
    });

    it('should handle tracking errors gracefully', async () => {
      const error = new Error('Tracking failed');
      mockedSendUsageEvent.mockImplementationOnce(() => {
        throw error;
      });

      await trackCommandUsage(mockCommand);

      expect(mockedUiLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(error.message)
      );
    });
  });

  describe('trackHelpUsage()', () => {
    const mockCommand = 'help-command';

    it('should not track when tracking is disabled via config', async () => {
      mockedGetConfig.mockReturnValue({ allowUsageTracking: false });

      await trackHelpUsage(mockCommand);

      expect(mockedSendUsageEvent).not.toHaveBeenCalled();
    });

    it('should not track when --disable-usage-tracking flag is set', async () => {
      process.env.DISABLE_USAGE_TRACKING = 'true';

      await trackHelpUsage(mockCommand);

      expect(mockedSendUsageEvent).not.toHaveBeenCalled();
      expect(mockedUiLogger.debug).toHaveBeenCalledWith(
        'Usage tracking is disabled via the --disable-usage-tracking flag, not sending usage events'
      );
    });

    it('should track help usage with command', async () => {
      await trackHelpUsage(mockCommand);

      expect(mockedSendUsageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'cli-interaction',
          eventClass: 'INTERACTION',
          meta: expect.objectContaining({
            action: 'cli-help',
            command: mockCommand,
            os: 'macos',
            nodeVersion: mockNodeVersion,
            nodeMajorVersion: 'v16',
            version,
          }),
        })
      );
    });

    it('should track main help usage without command', async () => {
      await trackHelpUsage('');

      expect(mockedUiLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('main command')
      );
    });

    it('should swallow async rejections from sendUsageEvent', async () => {
      const error = new Error('Network unavailable');
      mockedSendUsageEvent.mockRejectedValueOnce(error);

      await expect(trackHelpUsage(mockCommand)).resolves.toBeUndefined();

      expect(mockedUiLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(error.message)
      );
    });
  });

  describe('trackConvertFieldsUsage()', () => {
    const mockCommand = 'convert-fields-command';

    it('should not track when tracking is disabled via config', async () => {
      mockedGetConfig.mockReturnValue({ allowUsageTracking: false });

      await trackConvertFieldsUsage(mockCommand);

      expect(mockedSendUsageEvent).not.toHaveBeenCalled();
    });

    it('should not track when --disable-usage-tracking flag is set', async () => {
      process.env.DISABLE_USAGE_TRACKING = 'true';

      await trackConvertFieldsUsage(mockCommand);

      expect(mockedSendUsageEvent).not.toHaveBeenCalled();
    });

    it('should track convert fields usage', async () => {
      await trackConvertFieldsUsage(mockCommand);

      expect(mockedSendUsageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'cli-interaction',
          eventClass: 'INTERACTION',
          meta: expect.objectContaining({
            action: 'cli-process-fields',
            command: mockCommand,
            os: 'macos',
            nodeVersion: mockNodeVersion,
            nodeMajorVersion: 'v16',
            version,
          }),
        })
      );
    });
  });

  describe('trackAuthAction()', () => {
    const mockCommand = 'auth-command';
    const mockAuthType = 'oauth2';
    const mockStep = 'init';
    const mockAccountId = 123;

    it('should not track when tracking is disabled via config', async () => {
      mockedGetConfig.mockReturnValue({ allowUsageTracking: false });

      await trackAuthAction(mockCommand, mockAuthType, mockStep, mockAccountId);

      expect(mockedSendUsageEvent).not.toHaveBeenCalled();
    });

    it('should not track when --disable-usage-tracking flag is set', async () => {
      process.env.DISABLE_USAGE_TRACKING = 'true';

      await trackAuthAction(mockCommand, mockAuthType, mockStep, mockAccountId);

      expect(mockedSendUsageEvent).not.toHaveBeenCalled();
    });

    it('should track auth action', async () => {
      await trackAuthAction(mockCommand, mockAuthType, mockStep, mockAccountId);

      expect(mockedSendUsageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'cli-interaction',
          eventClass: 'INTERACTION',
          meta: expect.objectContaining({
            action: 'cli-auth',
            command: mockCommand,
            authType: mockAuthType,
            step: mockStep,
            os: 'macos',
            nodeVersion: mockNodeVersion,
            nodeMajorVersion: 'v16',
            version,
          }),
        })
      );
    });
  });

  describe('trackCommandMetadataUsage()', () => {
    const mockCommand = 'metadata-command';
    const mockMeta = { assetType: 'test-asset' };
    const mockAccountId = 123;

    it('should not track when tracking is disabled via config', async () => {
      mockedGetConfig.mockReturnValue({ allowUsageTracking: false });

      await trackCommandMetadataUsage(mockCommand, mockMeta, mockAccountId);

      expect(mockedSendUsageEvent).not.toHaveBeenCalled();
    });

    it('should not track when --disable-usage-tracking flag is set', async () => {
      process.env.DISABLE_USAGE_TRACKING = 'true';

      await trackCommandMetadataUsage(mockCommand, mockMeta, mockAccountId);

      expect(mockedSendUsageEvent).not.toHaveBeenCalled();
      expect(mockedUiLogger.debug).toHaveBeenCalledWith(
        'Usage tracking is disabled via the --disable-usage-tracking flag, not sending usage events'
      );
    });

    it('should track command metadata usage', async () => {
      await trackCommandMetadataUsage(mockCommand, mockMeta, mockAccountId);

      expect(mockedSendUsageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'cli-interaction',
          eventClass: 'INTERACTION',
          meta: expect.objectContaining({
            action: 'cli-command-metadata',
            command: mockCommand,
            assetType: 'test-asset',
            os: 'macos',
            nodeVersion: mockNodeVersion,
            nodeMajorVersion: 'v16',
            version,
          }),
        })
      );
    });
  });

  describe('MCP promotion tracking', () => {
    it('should track Dev MCP promotion shown metadata', async () => {
      await trackMcpPromotionShown('upgrade');

      expect(mockedSendUsageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'cli-interaction',
          eventClass: 'INTERACTION',
          meta: expect.objectContaining({
            action: 'cli-mcp-promotion',
            step: 'shown',
            command: 'upgrade',
            os: 'macos',
            nodeVersion: mockNodeVersion,
            nodeMajorVersion: 'v16',
            version,
          }),
        })
      );
    });
  });

  describe('Platform detection', () => {
    it('should return "macos" for darwin platform', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      await trackHelpUsage('test');

      expect(mockedSendUsageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ os: 'macos' }),
        })
      );
    });

    it('should return "windows" for win32 platform', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });

      await trackHelpUsage('test');

      expect(mockedSendUsageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ os: 'windows' }),
        })
      );
    });

    it('should return platform name for other platforms', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });

      await trackHelpUsage('test');

      expect(mockedSendUsageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ os: 'linux' }),
        })
      );
    });
  });

  describe('auto-attached metadata fields', () => {
    it('should attach configType "global" when config path matches the global config path', async () => {
      const globalPath = '/Users/test/.hubspot/config.yml';
      mockedGetConfigFilePath.mockReturnValue(globalPath);
      mockedGetGlobalConfigFilePath.mockReturnValue(globalPath);

      await trackHelpUsage('test');

      expect(mockedSendUsageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ configType: 'global' }),
        })
      );
    });

    it('should attach configType "local" when config path differs from the global config path', async () => {
      mockedGetConfigFilePath.mockReturnValue(
        '/some/project/hubspot.config.yml'
      );
      mockedGetGlobalConfigFilePath.mockReturnValue(
        '/Users/test/.hubspot/config.yml'
      );

      await trackHelpUsage('test');

      expect(mockedSendUsageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ configType: 'local' }),
        })
      );
    });

    it('should omit configType when getConfigFilePath throws', async () => {
      mockedGetConfigFilePath.mockImplementation(() => {
        throw new Error('no config');
      });

      await trackHelpUsage('test');

      const sentMeta = mockedSendUsageEvent.mock.calls[0][0].meta;
      expect(sentMeta.configType).toBeUndefined();
    });

    it('should attach executionSource "ci" when CI env var is set', async () => {
      process.env.CI = 'true';

      await trackHelpUsage('test');

      expect(mockedSendUsageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ executionSource: 'ci' }),
        })
      );
    });

    it('should attach executionSource "mcp" when HUBSPOT_MCP_AI_AGENT is set', async () => {
      process.env.HUBSPOT_MCP_AI_AGENT = 'cursor';

      await trackHelpUsage('test');

      expect(mockedSendUsageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ executionSource: 'mcp' }),
        })
      );
    });

    it('should attach executionSource "user" by default', async () => {
      await trackHelpUsage('test');

      expect(mockedSendUsageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ executionSource: 'user' }),
        })
      );
    });

    it('should pass through platformVersion from meta', async () => {
      await trackCommandUsage('project-upload', { platformVersion: '2026.1' });

      expect(mockedSendUsageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ platformVersion: '2026.1' }),
        })
      );
    });
  });
});

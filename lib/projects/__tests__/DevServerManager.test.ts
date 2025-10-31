import { vi, describe, it, expect, beforeEach } from 'vitest';
import DevServerManager from '../localDev/DevServerManager.js';
import LocalDevState from '../localDev/LocalDevState.js';
import LocalDevLogger from '../localDev/LocalDevLogger.js';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';

vi.mock('@hubspot/ui-extensions-dev-server', () => ({
  DevModeUnifiedInterface: {
    setup: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    fileChange: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@hubspot/local-dev-lib/portManager', () => ({
  requestPorts: vi.fn().mockResolvedValue({ 'test-port': 8080 }),
}));

vi.mock('@hubspot/local-dev-lib/api/localDevAuth', () => ({
  fetchAppInstallationData: vi.fn().mockResolvedValue({}),
}));

vi.mock('@hubspot/local-dev-lib/api/appsDev', () => ({
  fetchAppMetadataByUid: vi.fn().mockResolvedValue({}),
  fetchPublicAppProductionInstallCounts: vi.fn().mockResolvedValue({}),
  installStaticAuthAppOnTestAccount: vi.fn().mockResolvedValue({}),
}));

vi.mock('@hubspot/local-dev-lib/config', () => ({
  getAccountConfig: vi.fn().mockReturnValue({ accountId: 123 }),
  configFileExists: vi.fn().mockReturnValue(true),
  getAccountId: vi.fn().mockReturnValue(123),
  hasLocalStateFlag: vi.fn().mockReturnValue(false),
  getConfigDefaultAccount: vi.fn().mockReturnValue({ accountId: 123 }),
}));

vi.mock('@hubspot/local-dev-lib/urls', () => ({
  getHubSpotApiOrigin: vi.fn().mockReturnValue('https://api.hubspot.com'),
  getHubSpotWebsiteOrigin: vi.fn().mockReturnValue('https://app.hubspot.com'),
}));

vi.mock('../../ui/SpinniesManager', () => ({
  default: {
    add: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
    init: vi.fn(),
  },
}));

describe('DevServerManager', () => {
  let devServerManager: DevServerManager;
  let localDevState: LocalDevState;
  let logger: LocalDevLogger;

  beforeEach(() => {
    localDevState = new LocalDevState({
      targetProjectAccountId: 123,
      targetTestingAccountId: 456,
      projectConfig: {
        name: 'test-project',
        srcDir: 'src',
        platformVersion: '1.0.0',
      },
      projectDir: '/test/project',
      projectData: {
        name: 'test-project',
        id: 123,
        createdAt: Date.now(),
        deletedAt: 0,
        isLocked: false,
        portalId: 123,
        updatedAt: Date.now(),
      },
      debug: false,
      initialProjectNodes: {},
      initialProjectProfileData: {},
      profile: 'test',
      env: ENVIRONMENTS.QA,
    });

    logger = new LocalDevLogger(localDevState);

    devServerManager = new DevServerManager({
      localDevState,
      logger,
    });
  });

  describe('constructor', () => {
    it('should initialize with correct state', async () => {
      await expect(async () => {
        await devServerManager.start();
      }).rejects.toThrow(
        'The Dev Server Manager must be initialized before it is started.'
      );
    });
  });

  describe('setup', () => {
    it('should complete setup without errors', async () => {
      await expect(devServerManager.setup()).resolves.not.toThrow();
    });

    it('should allow start after successful setup', async () => {
      await devServerManager.setup();
      await expect(devServerManager.start()).resolves.not.toThrow();
    });

    it('should call setup on dev servers sequentially', async () => {
      const executionOrder: string[] = [];

      const { DevModeUnifiedInterface } = await import(
        '@hubspot/ui-extensions-dev-server'
      );
      const originalSetup = DevModeUnifiedInterface.setup;

      DevModeUnifiedInterface.setup = vi.fn().mockImplementation(async () => {
        executionOrder.push('UIExtensions-start');
        await new Promise(resolve => setTimeout(resolve, 20));
        executionOrder.push('UIExtensions-end');
      });

      const AppDevModeInterface = (
        await import('../localDev/AppDevModeInterface.js')
      ).default;
      const originalAppSetup = AppDevModeInterface.prototype.setup;

      AppDevModeInterface.prototype.setup = vi
        .fn()
        .mockImplementation(async function () {
          executionOrder.push('App-start');
          await new Promise(resolve => setTimeout(resolve, 20));
          executionOrder.push('App-end');
        });

      const testManager = new DevServerManager({
        localDevState,
        logger,
      });

      await testManager.setup();

      expect(executionOrder).toEqual([
        'App-start',
        'App-end',
        'UIExtensions-start',
        'UIExtensions-end',
      ]);

      expect(AppDevModeInterface.prototype.setup).toHaveBeenCalledTimes(1);
      expect(DevModeUnifiedInterface.setup).toHaveBeenCalledTimes(1);

      // Restore original methods
      DevModeUnifiedInterface.setup = originalSetup;
      AppDevModeInterface.prototype.setup = originalAppSetup;
    });
  });

  describe('start', () => {
    it('should throw error when not initialized', async () => {
      await expect(devServerManager.start()).rejects.toThrow();
    });

    it('should start successfully after setup', async () => {
      await devServerManager.setup();
      await expect(devServerManager.start()).resolves.not.toThrow();
    });

    it('should set started state correctly', async () => {
      await devServerManager.setup();
      await devServerManager.start();

      await expect(
        devServerManager.fileChange({ filePath: 'test.js', event: 'change' })
      ).resolves.not.toThrow();
    });
  });

  describe('fileChange', () => {
    it('should handle fileChange', async () => {
      await devServerManager.setup();
      await devServerManager.start();

      await expect(
        devServerManager.fileChange({
          filePath: 'src/test.js',
          event: 'change',
        })
      ).resolves.not.toThrow();
    });

    it('should handle different file events', async () => {
      await devServerManager.setup();
      await devServerManager.start();

      const testCases = [
        { filePath: 'src/component.js', event: 'add' },
        { filePath: 'src/style.css', event: 'change' },
        { filePath: 'src/config.json', event: 'unlink' },
      ];

      for (const testCase of testCases) {
        await expect(
          devServerManager.fileChange(testCase)
        ).resolves.not.toThrow();
      }
    });

    it('should handle concurrent fileChange calls', async () => {
      await devServerManager.setup();
      await devServerManager.start();

      const fileChanges = [
        devServerManager.fileChange({ filePath: 'file1.js', event: 'change' }),
        devServerManager.fileChange({ filePath: 'file2.js', event: 'add' }),
        devServerManager.fileChange({ filePath: 'file3.js', event: 'unlink' }),
      ];

      await expect(Promise.all(fileChanges)).resolves.not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should handle cleanup', async () => {
      await devServerManager.setup();
      await devServerManager.start();

      await expect(devServerManager.cleanup()).resolves.not.toThrow();
    });
  });
});

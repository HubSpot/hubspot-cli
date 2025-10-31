import { vi, describe, it, expect, beforeEach } from 'vitest';
import UIExtensionsDevModeInterface from '../localDev/UIExtensionsDevModeInterface.js';
import LocalDevState from '../localDev/LocalDevState.js';
import { DevModeUnifiedInterface } from '@hubspot/ui-extensions-dev-server';
import { requestPorts } from '@hubspot/local-dev-lib/portManager';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  getHubSpotApiOrigin,
  getHubSpotWebsiteOrigin,
} from '@hubspot/local-dev-lib/urls';
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

vi.mock('@hubspot/local-dev-lib/urls', () => ({
  getHubSpotApiOrigin: vi.fn().mockReturnValue('https://api.hubspot.com'),
  getHubSpotWebsiteOrigin: vi.fn().mockReturnValue('https://app.hubspot.com'),
}));

describe('UIExtensionsDevModeInterface', () => {
  let uiExtensionsInterface: UIExtensionsDevModeInterface;
  let mockLocalDevState: LocalDevState;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(DevModeUnifiedInterface.setup).mockResolvedValue(undefined);
    vi.mocked(DevModeUnifiedInterface.start).mockResolvedValue(undefined);
    vi.mocked(DevModeUnifiedInterface.fileChange).mockResolvedValue(undefined);
    vi.mocked(DevModeUnifiedInterface.cleanup).mockResolvedValue(undefined);

    mockLocalDevState = new LocalDevState({
      targetProjectAccountId: 123,
      targetTestingAccountId: 456,
      projectConfig: {
        name: 'test-ui-extensions-project',
        srcDir: 'src',
        platformVersion: '1.0.0',
      },
      projectDir: '/test/ui-extensions-project',
      projectData: {
        name: 'test-ui-extensions-project',
        id: 789,
        createdAt: Date.now(),
        deletedAt: 0,
        isLocked: false,
        portalId: 123,
        updatedAt: Date.now(),
      },
      debug: false,
      initialProjectNodes: {
        'test-component': {
          uid: 'test-component-uid',
          componentType: 'UI_EXTENSION',
          config: {
            name: 'Test UI Extension',
            type: 'card',
          },
          localDev: {
            componentRoot: '/test/path',
            componentConfigPath: '/test/path/config.json',
            configUpdatedSinceLastUpload: false,
            removed: false,
            parsingErrors: [],
          },
          componentDeps: {},
          metaFilePath: '/test/path',
          files: [],
        },
      },
      initialProjectProfileData: {
        testVariable: 'testValue',
      },
      profile: 'test',
      env: ENVIRONMENTS.QA,
    });

    uiExtensionsInterface = new UIExtensionsDevModeInterface({
      localDevState: mockLocalDevState,
    });
  });

  describe('constructor', () => {
    it('should store the localDevState reference', () => {
      expect(uiExtensionsInterface.localDevState).toBe(mockLocalDevState);
    });
  });

  describe('setup', () => {
    it('should call DevModeUnifiedInterface.setup with correct parameters', async () => {
      await uiExtensionsInterface.setup();

      expect(DevModeUnifiedInterface.setup).toHaveBeenCalledWith({
        components: mockLocalDevState.projectNodes,
        profileData: mockLocalDevState.projectProfileData,
        logger,
        urls: {
          api: 'https://api.hubspot.com',
          web: 'https://app.hubspot.com',
        },
      });
    });

    it('should use correct URLs based on environment', async () => {
      await uiExtensionsInterface.setup();

      expect(getHubSpotApiOrigin).toHaveBeenCalledWith(mockLocalDevState.env);
      expect(getHubSpotWebsiteOrigin).toHaveBeenCalledWith(
        mockLocalDevState.env
      );
    });

    it('should pass project nodes and profile data from state', async () => {
      await uiExtensionsInterface.setup();

      const setupCall = vi.mocked(DevModeUnifiedInterface.setup).mock
        .calls[0][0];
      expect(setupCall.components).toStrictEqual(
        mockLocalDevState.projectNodes
      );
      expect(setupCall.profileData).toStrictEqual(
        mockLocalDevState.projectProfileData
      );
    });
  });

  describe('start', () => {
    it('should call DevModeUnifiedInterface.start with correct parameters', async () => {
      await uiExtensionsInterface.start();

      expect(DevModeUnifiedInterface.start).toHaveBeenCalledWith({
        accountId: mockLocalDevState.targetTestingAccountId,
        projectConfig: mockLocalDevState.projectConfig,
        requestPorts,
      });
    });

    it('should use targetTestingAccountId from state', async () => {
      await uiExtensionsInterface.start();

      const startCall = vi.mocked(DevModeUnifiedInterface.start).mock
        .calls[0][0];
      expect(startCall.accountId).toBe(456); // targetTestingAccountId
    });

    it('should pass project config from state', async () => {
      await uiExtensionsInterface.start();

      const startCall = vi.mocked(DevModeUnifiedInterface.start).mock
        .calls[0][0];
      expect(startCall.projectConfig).toStrictEqual(
        mockLocalDevState.projectConfig
      );
    });
  });

  describe('fileChange', () => {
    it('should call DevModeUnifiedInterface.fileChange with correct parameters', async () => {
      const filePath = 'src/components/TestCard.tsx';
      const event = 'change';

      await uiExtensionsInterface.fileChange(filePath, event);

      expect(DevModeUnifiedInterface.fileChange).toHaveBeenCalledWith(
        filePath,
        event
      );
    });

    it('should handle different file events', async () => {
      const testCases = [
        { filePath: 'src/components/Card.tsx', event: 'add' },
        { filePath: 'src/styles/main.css', event: 'change' },
        { filePath: 'src/config.json', event: 'unlink' },
      ];

      for (const testCase of testCases) {
        await uiExtensionsInterface.fileChange(
          testCase.filePath,
          testCase.event
        );

        expect(DevModeUnifiedInterface.fileChange).toHaveBeenCalledWith(
          testCase.filePath,
          testCase.event
        );
      }

      expect(DevModeUnifiedInterface.fileChange).toHaveBeenCalledTimes(3);
    });
  });

  describe('cleanup', () => {
    it('should call DevModeUnifiedInterface.cleanup', async () => {
      await uiExtensionsInterface.cleanup();

      expect(DevModeUnifiedInterface.cleanup).toHaveBeenCalledWith();
    });
  });
});

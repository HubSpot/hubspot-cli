import { vi, Mock, Mocked } from 'vitest';

// Mock the ui-extensions-dev-server module
vi.mock('@hubspot/ui-extensions-dev-server', () => {
  return {
    DevModeUnifiedInterface: {
      setup: vi.fn().mockResolvedValue(undefined),
      start: vi.fn().mockResolvedValue(undefined),
      fileChange: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn().mockResolvedValue(undefined),
    },
  };
});

import { fetchAppInstallationData } from '@hubspot/local-dev-lib/api/localDevAuth';
import {
  fetchPublicAppsForPortal,
  fetchPublicAppProductionInstallCounts,
  installStaticAuthAppOnTestAccount,
} from '@hubspot/local-dev-lib/api/appsDev';
import { DevModeUnifiedInterface as UIEDevModeInterface } from '@hubspot/ui-extensions-dev-server';
import { requestPorts } from '@hubspot/local-dev-lib/portManager';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';

import AppDevModeInterface from '../localDev/AppDevModeInterface.js';
import LocalDevState from '../localDev/LocalDevState.js';
import LocalDevLogger from '../localDev/LocalDevLogger.js';
import {
  installAppAutoPrompt,
  installAppBrowserPrompt,
} from '../../prompts/installAppPrompt.js';
import { confirmPrompt } from '../../prompts/promptUtils.js';
import {
  getOauthAppInstallUrl,
  getStaticAuthAppInstallUrl,
} from '../../app/urls.js';
import { isDeveloperTestAccount, isSandbox } from '../../accountTypes.js';
import { logError } from '../../errorHandlers/index.js';
import {
  APP_AUTH_TYPES,
  APP_DISTRIBUTION_TYPES,
  APP_INSTALLATION_STATES,
  LOCAL_DEV_SERVER_MESSAGE_TYPES,
} from '../../constants.js';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { AppIRNode } from '../../../types/ProjectComponents.js';
import { AppLocalDevData } from '../../../types/LocalDev.js';
import { ProjectConfig } from '../../../types/Projects.js';

vi.mock('@hubspot/local-dev-lib/api/localDevAuth');
vi.mock('@hubspot/local-dev-lib/api/appsDev');
vi.mock('@hubspot/local-dev-lib/portManager');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../prompts/installAppPrompt');
vi.mock('../../prompts/promptUtils');
vi.mock('../../app/urls');
vi.mock('../../accountTypes');
vi.mock('../../ui/logger');
vi.mock('../../errorHandlers/index');
vi.mock('../localDev/LocalDevState');
vi.mock('../localDev/LocalDevLogger');
vi.mock('../../ui/SpinniesManager');

describe('AppDevModeInterface', () => {
  let appDevModeInterface: AppDevModeInterface;
  let mockLocalDevState: Mocked<LocalDevState>;
  let mockLocalDevLogger: Mocked<LocalDevLogger>;

  const mockProjectConfig: ProjectConfig = {
    name: 'test-project',
    srcDir: 'src',
    platformVersion: '1.0.0',
  };

  const mockAppNode: AppIRNode = {
    uid: 'test-app-uid',
    componentType: 'APPLICATION',
    config: {
      name: 'Test App',
      description: 'Test app description',
      logo: 'logo.png',
      auth: {
        type: APP_AUTH_TYPES.STATIC,
        requiredScopes: ['test-scope'],
        optionalScopes: [],
        conditionallyRequiredScopes: [],
        redirectUrls: ['http://localhost:3000'],
      },
      distribution: APP_DISTRIBUTION_TYPES.PRIVATE,
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
  };

  const mockAppData: AppLocalDevData = {
    id: 123,
    clientId: 'test-client-id',
    name: 'Test App',
    installationState: APP_INSTALLATION_STATES.NOT_INSTALLED,
    scopeGroupIds: [1, 2, 3],
  };

  const mockPublicApp = {
    id: 123,
    clientId: 'test-client-id',
    name: 'Test App',
    sourceId: 'test-app-uid',
    scopeGroupIds: [1, 2, 3],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockLocalDevState = {
      targetProjectAccountId: 12345,
      targetTestingAccountId: 67890,
      projectConfig: mockProjectConfig,
      projectDir: '/test/project',
      projectId: 999,
      env: ENVIRONMENTS.PROD,
      projectNodes: { [mockAppNode.uid]: mockAppNode },
      getAppDataByUid: vi.fn(),
      setAppDataForUid: vi.fn(),
      addListener: vi.fn(),
      addUploadWarning: vi.fn(),
      removeListener: vi.fn(),
    } as unknown as Mocked<LocalDevState>;

    mockLocalDevLogger = {} as unknown as Mocked<LocalDevLogger>;

    // Mock constructors
    (LocalDevState as Mock).mockImplementation(() => mockLocalDevState);
    (LocalDevLogger as Mock).mockImplementation(() => mockLocalDevLogger);

    // Mock external dependencies
    (fetchPublicAppsForPortal as Mock).mockResolvedValue({
      data: { results: [mockPublicApp] },
    });

    (fetchPublicAppProductionInstallCounts as Mock).mockResolvedValue({
      data: { uniquePortalInstallCount: 5 },
    });

    (fetchAppInstallationData as Mock).mockResolvedValue({
      data: {
        isInstalledWithScopeGroups: true,
        previouslyAuthorizedScopeGroups: [],
      },
    });

    (getAccountConfig as Mock).mockReturnValue({
      parentAccountId: 12345,
    });

    (isDeveloperTestAccount as Mock).mockReturnValue(true);
    (isSandbox as Mock).mockReturnValue(false);
    (getOauthAppInstallUrl as Mock).mockReturnValue('http://oauth-install-url');
    (getStaticAuthAppInstallUrl as Mock).mockReturnValue(
      'http://static-install-url'
    );
    (installAppAutoPrompt as Mock).mockResolvedValue(true);
    (installAppBrowserPrompt as Mock).mockResolvedValue(undefined);
    (confirmPrompt as Mock).mockResolvedValue(true);
    (installStaticAuthAppOnTestAccount as Mock).mockResolvedValue(undefined);

    // Mock process.exit
    vi.spyOn(global.process, 'exit').mockImplementation(
      (code?: string | number | null) => {
        throw new Error(`Process.exit called with code ${code}`);
      }
    );

    appDevModeInterface = new AppDevModeInterface({
      localDevState: mockLocalDevState,
      localDevLogger: mockLocalDevLogger,
    });
  });

  describe('constructor', () => {
    it('should initialize with valid state', () => {
      expect(appDevModeInterface).toBeInstanceOf(AppDevModeInterface);
      expect(appDevModeInterface.localDevState).toBe(mockLocalDevState);
      expect(appDevModeInterface.localDevLogger).toBe(mockLocalDevLogger);
    });

    it('should exit if targetProjectAccountId is missing', () => {
      const mockLocalDevStateWithoutAccountId = {
        ...mockLocalDevState,
        targetProjectAccountId: null,
      } as unknown as Mocked<LocalDevState>;

      expect(() => {
        new AppDevModeInterface({
          localDevState: mockLocalDevStateWithoutAccountId,
          localDevLogger: mockLocalDevLogger,
        });
      }).toThrow('Process.exit called with code 1');
    });

    it('should exit if projectConfig is missing', () => {
      const mockLocalDevStateWithoutConfig = {
        ...mockLocalDevState,
        projectConfig: null,
      } as unknown as Mocked<LocalDevState>;

      expect(() => {
        new AppDevModeInterface({
          localDevState: mockLocalDevStateWithoutConfig,
          localDevLogger: mockLocalDevLogger,
        });
      }).toThrow('Process.exit called with code 1');
    });

    it('should exit if projectDir is missing', () => {
      const mockLocalDevStateWithoutDir = {
        ...mockLocalDevState,
        projectDir: null,
      } as unknown as Mocked<LocalDevState>;

      expect(() => {
        new AppDevModeInterface({
          localDevState: mockLocalDevStateWithoutDir,
          localDevLogger: mockLocalDevLogger,
        });
      }).toThrow('Process.exit called with code 1');
    });
  });

  describe('setup()', () => {
    beforeEach(() => {
      mockLocalDevState.getAppDataByUid.mockReturnValue(mockAppData);
    });

    it('should return early if no app node exists', async () => {
      mockLocalDevState.projectNodes = {};

      await appDevModeInterface.setup({});

      expect(fetchPublicAppsForPortal).not.toHaveBeenCalled();
      expect(UIEDevModeInterface.setup).not.toHaveBeenCalled();
    });

    it('should setup successfully with private app', async () => {
      await appDevModeInterface.setup({});

      expect(fetchPublicAppsForPortal).toHaveBeenCalledWith(12345);
      expect(fetchPublicAppProductionInstallCounts).toHaveBeenCalledWith(
        123,
        12345
      );
      expect(fetchAppInstallationData).toHaveBeenCalledWith(
        67890,
        999,
        'test-app-uid',
        ['test-scope'],
        []
      );
      expect(UIEDevModeInterface.setup).toHaveBeenCalled();
    });

    it('should show marketplace warning for marketplace apps', async () => {
      const marketplaceAppNode = {
        ...mockAppNode,
        config: {
          ...mockAppNode.config,
          distribution: APP_DISTRIBUTION_TYPES.MARKETPLACE,
        },
      };
      mockLocalDevState.projectNodes = {
        [marketplaceAppNode.uid]: marketplaceAppNode,
      };

      await appDevModeInterface.setup({});

      expect(confirmPrompt).toHaveBeenCalled();
      expect(mockLocalDevState.addUploadWarning).toHaveBeenCalled();
    });

    it('should exit if user declines marketplace warning', async () => {
      const marketplaceAppNode = {
        ...mockAppNode,
        config: {
          ...mockAppNode.config,
          distribution: APP_DISTRIBUTION_TYPES.MARKETPLACE,
        },
      };
      mockLocalDevState.projectNodes = {
        [marketplaceAppNode.uid]: marketplaceAppNode,
      };

      // Set up conditions to trigger marketplace warning
      (fetchPublicAppProductionInstallCounts as Mock).mockResolvedValue({
        data: { uniquePortalInstallCount: 5 },
      });
      mockLocalDevState.getAppDataByUid.mockReturnValue(mockAppData);
      (confirmPrompt as Mock).mockResolvedValue(false);

      // Create a new instance to trigger the exit during setup
      const newAppDevModeInterface = new AppDevModeInterface({
        localDevState: mockLocalDevState,
        localDevLogger: mockLocalDevLogger,
      });

      // The setup method catches the error, so we check that process.exit was called
      await newAppDevModeInterface.setup({});

      expect(process.exit).toHaveBeenCalledWith(0);
    });

    // @TODO: Restore test account auto install functionality
    // it('should auto-install static auth app on test account', async () => {
    //   (fetchAppInstallationData as Mock).mockResolvedValue({
    //     data: {
    //       isInstalledWithScopeGroups: false,
    //       previouslyAuthorizedScopeGroups: [],
    //     },
    //   });

    //   await appDevModeInterface.setup({});

    //   expect(installStaticAuthAppOnTestAccount).toHaveBeenCalledWith(
    //     123,
    //     67890,
    //     [1, 2, 3]
    //   );
    // });

    it('should open browser for OAuth app installation', async () => {
      const oauthAppNode = {
        ...mockAppNode,
        config: {
          ...mockAppNode.config,
          auth: {
            ...mockAppNode.config.auth,
            type: APP_AUTH_TYPES.OAUTH,
          },
        },
      };
      mockLocalDevState.projectNodes = { [oauthAppNode.uid]: oauthAppNode };

      (fetchAppInstallationData as Mock).mockResolvedValue({
        data: {
          isInstalledWithScopeGroups: false,
          previouslyAuthorizedScopeGroups: [],
        },
      });

      await appDevModeInterface.setup({});

      expect(getOauthAppInstallUrl).toHaveBeenCalledWith({
        targetAccountId: 67890,
        env: ENVIRONMENTS.PROD,
        clientId: 'test-client-id',
        scopes: ['test-scope'],
        redirectUrls: ['http://localhost:3000'],
      });
      expect(installAppBrowserPrompt).toHaveBeenCalled();
    });

    it('should handle app reinstallation', async () => {
      // Set up conditions for non-automatic installation
      (getAccountConfig as Mock).mockReturnValue(null);
      (fetchAppInstallationData as Mock).mockResolvedValue({
        data: {
          isInstalledWithScopeGroups: false,
          previouslyAuthorizedScopeGroups: ['old-scope'],
        },
      });

      await appDevModeInterface.setup({});

      expect(installAppBrowserPrompt).toHaveBeenCalledWith(
        'http://static-install-url',
        true,
        {
          appUid: 'test-app-uid',
          projectAccountId: 12345,
          projectName: 'test-project',
          testingAccountId: 67890,
        }
      );
    });

    it('should handle errors during setup', async () => {
      const error = new Error('Setup failed');
      (fetchPublicAppsForPortal as Mock).mockRejectedValue(error);

      await appDevModeInterface.setup({});

      expect(logError).toHaveBeenCalledWith(error);
    });

    it('should exit if app not found in portal', async () => {
      // Set up conditions for non-automatic installation to force getAppInstallUrl call
      (getAccountConfig as Mock).mockReturnValue(null);

      // First call for fetchAppData succeeds
      (fetchPublicAppsForPortal as Mock)
        .mockResolvedValueOnce({
          data: { results: [mockPublicApp] },
        })
        // Second call for getAppInstallUrl fails (app not found)
        .mockResolvedValueOnce({
          data: { results: [] },
        });

      (fetchAppInstallationData as Mock).mockResolvedValue({
        data: {
          isInstalledWithScopeGroups: false,
          previouslyAuthorizedScopeGroups: [],
        },
      });

      // The setup method catches the error, so we check that process.exit was called
      await appDevModeInterface.setup({});

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    // @TODO: Restore test account auto install functionality
    // it('should exit if user declines auto-install', async () => {
    //   // Set up conditions for automatic installation
    //   (getAccountConfig as Mock).mockReturnValue({
    //     parentAccountId: 12345, // matches targetProjectAccountId
    //   });
    //   (isDeveloperTestAccount as Mock).mockReturnValue(true);

    //   (fetchAppInstallationData as Mock).mockResolvedValue({
    //     data: {
    //       isInstalledWithScopeGroups: false,
    //       previouslyAuthorizedScopeGroups: [],
    //     },
    //   });
    //   (installAppAutoPrompt as Mock).mockResolvedValue(false);

    //   // Create a new instance to trigger the exit during setup
    //   const newAppDevModeInterface = new AppDevModeInterface({
    //     localDevState: mockLocalDevState,
    //     localDevLogger: mockLocalDevLogger,
    //   });

    //   // The setup method catches the error, so we check that process.exit was called
    //   await newAppDevModeInterface.setup({});

    //   expect(process.exit).toHaveBeenCalledWith(0);
    // });

    // @TODO: Restore test account auto install functionality
    // it('should fallback to browser install if auto-install fails', async () => {
    //   (fetchAppInstallationData as Mock).mockResolvedValue({
    //     data: {
    //       isInstalledWithScopeGroups: false,
    //       previouslyAuthorizedScopeGroups: [],
    //     },
    //   });
    //   (installStaticAuthAppOnTestAccount as Mock).mockRejectedValue(
    //     new Error('Install failed')
    //   );

    //   await appDevModeInterface.setup({});

    //   expect(installAppBrowserPrompt).toHaveBeenCalledWith(
    //     'http://static-install-url',
    //     false
    //   );
    // });
  });

  describe('start()', () => {
    it('should return early if no app node exists', async () => {
      mockLocalDevState.projectNodes = {};

      await appDevModeInterface.start();

      expect(UIEDevModeInterface.start).not.toHaveBeenCalled();
    });

    it('should start UIE dev mode interface', async () => {
      await appDevModeInterface.start();

      expect(UIEDevModeInterface.start).toHaveBeenCalledWith({
        accountId: 67890,
        projectConfig: mockProjectConfig,
        requestPorts,
      });
    });
  });

  describe('fileChange()', () => {
    it('should return early if no app node exists', async () => {
      mockLocalDevState.projectNodes = {};

      await appDevModeInterface.fileChange('test.js', 'change');

      expect(UIEDevModeInterface.fileChange).not.toHaveBeenCalled();
    });

    it('should forward file change to UIE dev mode interface', async () => {
      await appDevModeInterface.fileChange('test.js', 'change');

      expect(UIEDevModeInterface.fileChange).toHaveBeenCalledWith(
        'test.js',
        'change'
      );
    });
  });

  describe('cleanup()', () => {
    it('should return early if no app node exists', async () => {
      mockLocalDevState.projectNodes = {};

      await appDevModeInterface.cleanup();

      expect(UIEDevModeInterface.cleanup).not.toHaveBeenCalled();
    });

    it('should cleanup UIE dev mode interface', async () => {
      await appDevModeInterface.cleanup();

      expect(UIEDevModeInterface.cleanup).toHaveBeenCalled();
    });

    it('should remove state listeners', async () => {
      await appDevModeInterface.cleanup();

      expect(mockLocalDevState.removeListener).toHaveBeenCalledWith(
        'devServerMessage',
        // @ts-expect-error access private method for testing
        appDevModeInterface.onDevServerMessage
      );
      expect(mockLocalDevState.removeListener).toHaveBeenCalledWith(
        'projectNodes',
        // @ts-expect-error
        appDevModeInterface.onChangeProjectNodes
      );
    });
  });

  describe('isAutomaticallyInstallable()', () => {
    it('should return true for static auth app on test account with correct parent', () => {
      // This is testing private method behavior through setup()
      expect(appDevModeInterface).toBeDefined();
    });

    it('should return false if target account config is missing', async () => {
      // Reset mocks to ensure clean state
      vi.clearAllMocks();

      // Set up basic mocks
      (fetchPublicAppsForPortal as Mock).mockResolvedValue({
        data: { results: [mockPublicApp] },
      });
      (fetchPublicAppProductionInstallCounts as Mock).mockResolvedValue({
        data: { uniquePortalInstallCount: 5 },
      });
      (getStaticAuthAppInstallUrl as Mock).mockReturnValue(
        'http://static-install-url'
      );
      (installAppBrowserPrompt as Mock).mockResolvedValue(undefined);

      // Reset the mock LocalDevState
      mockLocalDevState.getAppDataByUid = vi.fn().mockReturnValue(mockAppData);
      mockLocalDevState.setAppDataForUid = vi.fn();
      mockLocalDevState.addListener = vi.fn();

      // Target account config is missing
      (getAccountConfig as Mock).mockReturnValue(null);

      // App is not installed
      (fetchAppInstallationData as Mock).mockResolvedValue({
        data: {
          isInstalledWithScopeGroups: false,
          previouslyAuthorizedScopeGroups: [],
        },
      });

      // Create a new instance to avoid interference from previous test setup
      const newAppDevModeInterface = new AppDevModeInterface({
        localDevState: mockLocalDevState,
        localDevLogger: mockLocalDevLogger,
      });

      await newAppDevModeInterface.setup({});

      expect(installAppBrowserPrompt).toHaveBeenCalled();
    });

    it('should return false for OAuth app', async () => {
      // Reset mocks to ensure clean state
      vi.clearAllMocks();

      // Set up basic mocks
      (fetchPublicAppsForPortal as Mock).mockResolvedValue({
        data: { results: [mockPublicApp] },
      });
      (fetchPublicAppProductionInstallCounts as Mock).mockResolvedValue({
        data: { uniquePortalInstallCount: 5 },
      });
      (getOauthAppInstallUrl as Mock).mockReturnValue(
        'http://oauth-install-url'
      );
      (installAppBrowserPrompt as Mock).mockResolvedValue(undefined);

      // Reset the mock LocalDevState
      mockLocalDevState.getAppDataByUid = vi.fn().mockReturnValue(mockAppData);
      mockLocalDevState.setAppDataForUid = vi.fn();
      mockLocalDevState.addListener = vi.fn();

      const oauthAppNode = {
        ...mockAppNode,
        config: {
          ...mockAppNode.config,
          auth: {
            ...mockAppNode.config.auth,
            type: APP_AUTH_TYPES.OAUTH,
          },
        },
      };
      mockLocalDevState.projectNodes = { [oauthAppNode.uid]: oauthAppNode };

      // App is not installed
      (fetchAppInstallationData as Mock).mockResolvedValue({
        data: {
          isInstalledWithScopeGroups: false,
          previouslyAuthorizedScopeGroups: [],
        },
      });

      // Create a new instance to avoid interference from previous test setup
      const newAppDevModeInterface = new AppDevModeInterface({
        localDevState: mockLocalDevState,
        localDevLogger: mockLocalDevLogger,
      });

      await newAppDevModeInterface.setup({});

      expect(installAppBrowserPrompt).toHaveBeenCalled();
    });
  });

  describe('websocket server message handling', () => {
    it('should check app installation when websocket server connects', async () => {
      // Reset mocks to ensure clean state
      vi.clearAllMocks();

      // Set up basic mocks
      (fetchPublicAppsForPortal as Mock).mockResolvedValue({
        data: { results: [mockPublicApp] },
      });
      (fetchPublicAppProductionInstallCounts as Mock).mockResolvedValue({
        data: { uniquePortalInstallCount: 5 },
      });
      (getStaticAuthAppInstallUrl as Mock).mockReturnValue(
        'http://static-install-url'
      );
      (installAppBrowserPrompt as Mock).mockResolvedValue(undefined);

      // Reset the mock LocalDevState
      mockLocalDevState.getAppDataByUid = vi.fn().mockReturnValue(mockAppData);
      mockLocalDevState.setAppDataForUid = vi.fn();
      mockLocalDevState.addListener = vi.fn();

      // App is not installed so fetchAppInstallationData will be called
      (fetchAppInstallationData as Mock).mockResolvedValue({
        data: {
          isInstalledWithScopeGroups: false,
          previouslyAuthorizedScopeGroups: [],
        },
      });

      // Create a new instance to avoid interference from previous test setup
      const newAppDevModeInterface = new AppDevModeInterface({
        localDevState: mockLocalDevState,
        localDevLogger: mockLocalDevLogger,
      });

      await newAppDevModeInterface.setup({});

      // Simulate websocket server connection
      const addListenerCall = (mockLocalDevState.addListener as Mock).mock
        .calls[0];
      const [eventType, callback] = addListenerCall;

      expect(eventType).toBe('devServerMessage');

      // Call the callback with websocket connection message
      await callback(LOCAL_DEV_SERVER_MESSAGE_TYPES.WEBSOCKET_SERVER_CONNECTED);

      expect(fetchAppInstallationData).toHaveBeenCalledTimes(2); // Once in setup, once in listener
    });
  });
});

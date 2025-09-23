import path from 'path';
import { ArgumentsCamelCase } from 'yargs';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import { translateForLocalDev } from '@hubspot/project-parsing-lib';
import {
  getConfigAccounts,
  getAccountConfig,
} from '@hubspot/local-dev-lib/config';
import { getValidEnv } from '@hubspot/local-dev-lib/environment';
import { ProjectDevArgs } from '../../../types/Yargs.js';
import { ProjectConfig } from '../../../types/Projects.js';
import { logError } from '../../../lib/errorHandlers/index.js';
import { ensureProjectExists } from '../../../lib/projects/ensureProjectExists.js';
import {
  createInitialBuildForNewProject,
  createNewProjectForLocalDev,
} from '../../../lib/projects/localDev/helpers/project.js';
import {
  useExistingDevTestAccount,
  createDeveloperTestAccountForLocalDev,
  selectAccountTypePrompt,
} from '../../../lib/projects/localDev/helpers/account.js';
import {
  selectDeveloperTestTargetAccountPrompt,
  selectSandboxTargetAccountPrompt,
} from '../../../lib/prompts/projectDevTargetAccountPrompt.js';
import SpinniesManager from '../../../lib/ui/SpinniesManager.js';
import LocalDevProcess from '../../../lib/projects/localDev/LocalDevProcess.js';
import LocalDevWatcher from '../../../lib/projects/localDev/LocalDevWatcher.js';
import LocalDevWebsocketServer from '../../../lib/projects/localDev/LocalDevWebsocketServer.js';
import { handleExit, handleKeypress } from '../../../lib/process.js';
import {
  isTestAccountOrSandbox,
  isUnifiedAccount,
} from '../../../lib/accountTypes.js';
import { uiLine } from '../../../lib/ui/index.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { commands } from '../../../lang/en.js';
import { unifiedProjectDevFlow } from '../dev/unifiedFlow.js';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { Mock, vi, Mocked } from 'vitest';

// Mock @hubspot/ui-extensions-dev-server
vi.mock('@hubspot/ui-extensions-dev-server', () => ({
  DevModeUnifiedInterface: {
    setup: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    fileChange: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock all dependencies
vi.mock('@hubspot/project-parsing-lib');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('@hubspot/local-dev-lib/environment');
vi.mock('../../../lib/errorHandlers');
vi.mock('../../../lib/projects/ensureProjectExists');
vi.mock('../../../lib/projects/localDev/helpers/project');
vi.mock('../../../lib/projects/localDev/helpers/account');
vi.mock('../../../lib/prompts/projectDevTargetAccountPrompt');
vi.mock('../../../lib/ui/SpinniesManager');
vi.mock('../../../lib/projects/localDev/LocalDevProcess');
vi.mock('../../../lib/projects/localDev/LocalDevWatcher');
vi.mock('../../../lib/projects/localDev/LocalDevWebsocketServer');
vi.mock('../../../lib/process');
vi.mock('../../../lib/accountTypes');
vi.mock('../../../lib/ui');
vi.mock('../../../lib/ui/logger');

describe('unifiedProjectDevFlow', () => {
  const mockArgs: ArgumentsCamelCase<ProjectDevArgs> = {
    profile: 'test-profile',
    d: false,
    debug: false,
    derivedAccountId: 123,
    userProvidedAccount: undefined,
    testingAccount: undefined,
    projectAccount: undefined,
    _: [],
    $0: 'hs',
  };

  const mockProjectConfig: ProjectConfig = {
    name: 'test-project',
    srcDir: 'src',
    platformVersion: '1.0.0',
  };

  const mockProjectDir = '/test/project.js';
  const mockTargetProjectAccountId = 123;
  const mockProvidedTargetTestingAccountId = 456;

  // const mockProfileConfig: HsProfileFile = {
  //   accountId: 789,
  // };

  const mockAccountConfig = {
    accountId: 123,
    name: 'test-account',
    accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD,
  };

  const mockProject = {
    id: 1,
    name: 'test-project',
    deployedBuild: {
      buildId: 123,
      status: 'SUCCESS',
    },
    sourceIntegration: null,
  };

  const mockProjectNodes = {
    component1: {
      uid: 'component1',
      componentType: 'APP',
      localDev: {
        componentRoot: '/test/path',
        componentConfigPath: '/test/path/config.json',
        configUpdatedSinceLastUpload: false,
      },
    },
  };

  const mockLocalDevProcess: Mocked<Partial<LocalDevProcess>> = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  };

  const mockLocalDevWatcher: Mocked<Partial<LocalDevWatcher>> = {
    start: vi.fn(),
    stop: vi.fn().mockResolvedValue(undefined),
  };

  const mockWebsocketServer: Mocked<Partial<LocalDevWebsocketServer>> = {
    start: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock process.exit
    vi.spyOn(global.process, 'exit').mockImplementation(
      (code?: string | number | null) => {
        throw new Error(`Process.exit called with code ${code}`);
      }
    );

    // Setup default mocks
    (getValidEnv as Mock).mockReturnValue(ENVIRONMENTS.PROD);
    (translateForLocalDev as Mock).mockResolvedValue({
      intermediateNodesIndexedByUid: mockProjectNodes,
    });
    (getAccountConfig as Mock).mockReturnValue(mockAccountConfig);
    (getConfigAccounts as Mock).mockReturnValue([mockAccountConfig]);
    (isUnifiedAccount as Mock).mockResolvedValue(true);
    (isTestAccountOrSandbox as Mock).mockReturnValue(false);
    (ensureProjectExists as Mock).mockResolvedValue({
      projectExists: true,
      project: mockProject,
    });
    (SpinniesManager.init as Mock).mockImplementation(() => {});
    (LocalDevProcess as Mock).mockImplementation(() => mockLocalDevProcess);
    (LocalDevWatcher as Mock).mockImplementation(() => mockLocalDevWatcher);
    (LocalDevWebsocketServer as Mock).mockImplementation(
      () => mockWebsocketServer
    );
    (handleKeypress as Mock).mockImplementation(() => {});
    (handleExit as Mock).mockImplementation(() => {});
    (uiLogger.debug as Mock).mockImplementation(() => {});
    (uiLogger.error as Mock).mockImplementation(() => {});
    (uiLogger.log as Mock).mockImplementation(() => {});
    (uiLine as Mock).mockImplementation(() => {});
  });

  describe('successful flow', () => {
    it('should complete successfully with existing project and provided testing account', async () => {
      await unifiedProjectDevFlow({
        args: mockArgs,
        targetProjectAccountId: mockTargetProjectAccountId,
        providedTargetTestingAccountId: mockProvidedTargetTestingAccountId,
        projectConfig: mockProjectConfig,
        projectDir: mockProjectDir,
      });

      expect(translateForLocalDev).toHaveBeenCalledWith(
        {
          projectSourceDir: path.join(mockProjectDir, mockProjectConfig.srcDir),
          platformVersion: mockProjectConfig.platformVersion,
          accountId: mockTargetProjectAccountId,
        },
        { profile: mockArgs.profile }
      );

      expect(mockLocalDevProcess.start).toHaveBeenCalled();
      expect(mockLocalDevWatcher.start).toHaveBeenCalled();
      expect(mockWebsocketServer.start).toHaveBeenCalled();
    });

    // TODO: Restore test once we've switched back to using profile account for testing
    // it('should complete successfully with profile config', async () => {
    //   await unifiedProjectDevFlow({
    //     args: mockArgs,
    //     targetProjectAccountId: mockTargetProjectAccountId,
    //     projectConfig: mockProjectConfig,
    //     projectDir: mockProjectDir,
    //     profileConfig: mockProfileConfig,
    //   });

    //   expect(LocalDevProcess).toHaveBeenCalledWith(
    //     expect.objectContaining({

    //       targetTestingAccountId: mockProfileConfig.accountId,
    //     })
    //   );
    // });

    it('should use target project account as testing account when it is a test account', async () => {
      (isTestAccountOrSandbox as Mock).mockReturnValue(true);

      await unifiedProjectDevFlow({
        args: mockArgs,
        targetProjectAccountId: mockTargetProjectAccountId,
        projectConfig: mockProjectConfig,
        projectDir: mockProjectDir,
      });

      expect(LocalDevProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          targetTestingAccountId: mockTargetProjectAccountId,
        })
      );
    });
  });

  describe('error handling', () => {
    it('should exit with error code when translation fails', async () => {
      const translationError = new Error('Translation failed');
      (translateForLocalDev as Mock).mockRejectedValue(translationError);

      await expect(
        unifiedProjectDevFlow({
          args: mockArgs,
          targetProjectAccountId: mockTargetProjectAccountId,
          projectConfig: mockProjectConfig,
          projectDir: mockProjectDir,
        })
      ).rejects.toThrow('Process.exit called with code 1');

      expect(logError).toHaveBeenCalledWith(translationError);
    });

    it('should exit with success when no runnable components found', async () => {
      (translateForLocalDev as Mock).mockResolvedValue({
        intermediateNodesIndexedByUid: {},
      });

      await expect(
        unifiedProjectDevFlow({
          args: mockArgs,
          targetProjectAccountId: mockTargetProjectAccountId,
          projectConfig: mockProjectConfig,
          projectDir: mockProjectDir,
        })
      ).rejects.toThrow('Process.exit called with code 0');

      expect(uiLogger.error).toHaveBeenCalledWith(
        commands.project.dev.errors.noRunnableComponents
      );
    });

    it('should exit with error when account config not found', async () => {
      (getAccountConfig as Mock).mockReturnValue(null);

      await expect(
        unifiedProjectDevFlow({
          args: mockArgs,
          targetProjectAccountId: mockTargetProjectAccountId,
          projectConfig: mockProjectConfig,
          projectDir: mockProjectDir,
        })
      ).rejects.toThrow('Process.exit called with code 1');

      expect(uiLogger.error).toHaveBeenCalledWith(
        commands.project.dev.errors.noAccount(mockTargetProjectAccountId)
      );
    });

    it('should exit with error when account is not combined and no profile', async () => {
      (isUnifiedAccount as Mock).mockResolvedValue(false);

      await expect(
        unifiedProjectDevFlow({
          args: mockArgs,
          targetProjectAccountId: mockTargetProjectAccountId,
          projectConfig: mockProjectConfig,
          projectDir: mockProjectDir,
        })
      ).rejects.toThrow('Process.exit called with code 1');

      expect(uiLogger.error).toHaveBeenCalledWith(
        commands.project.dev.errors.accountNotCombined
      );
    });
  });

  describe('account type selection and prompting', () => {
    beforeEach(() => {
      // Reset to require prompting
      (isTestAccountOrSandbox as Mock).mockReturnValue(false);
    });

    it('should prompt for account type when no testing account provided', async () => {
      (selectAccountTypePrompt as Mock).mockResolvedValue(
        HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST
      );
      (selectDeveloperTestTargetAccountPrompt as Mock).mockResolvedValue({
        targetAccountId: 456,
      });

      await unifiedProjectDevFlow({
        args: mockArgs,
        targetProjectAccountId: mockTargetProjectAccountId,
        projectConfig: mockProjectConfig,
        projectDir: mockProjectDir,
      });

      expect(selectAccountTypePrompt).toHaveBeenCalledWith(mockAccountConfig);
      expect(selectDeveloperTestTargetAccountPrompt).toHaveBeenCalled();
    });

    it('should handle developer test account creation', async () => {
      (selectAccountTypePrompt as Mock).mockResolvedValue(
        HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST
      );
      (selectDeveloperTestTargetAccountPrompt as Mock).mockResolvedValue({
        createNestedAccount: true,
      });
      (createDeveloperTestAccountForLocalDev as Mock).mockResolvedValue(999);

      await unifiedProjectDevFlow({
        args: mockArgs,
        targetProjectAccountId: mockTargetProjectAccountId,
        projectConfig: mockProjectConfig,
        projectDir: mockProjectDir,
      });

      expect(createDeveloperTestAccountForLocalDev).toHaveBeenCalledWith(
        mockTargetProjectAccountId,
        mockAccountConfig,
        ENVIRONMENTS.PROD,
        true
      );
      expect(LocalDevProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          targetTestingAccountId: 999,
        })
      );
    });

    it('should handle existing developer test account not in config', async () => {
      const notInConfigAccount = { accountId: 777, name: 'external-account' };
      (selectAccountTypePrompt as Mock).mockResolvedValue(
        HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST
      );
      (selectDeveloperTestTargetAccountPrompt as Mock).mockResolvedValue({
        notInConfigAccount,
      });

      await unifiedProjectDevFlow({
        args: mockArgs,
        targetProjectAccountId: mockTargetProjectAccountId,
        projectConfig: mockProjectConfig,
        projectDir: mockProjectDir,
      });

      expect(useExistingDevTestAccount).toHaveBeenCalledWith(
        ENVIRONMENTS.PROD,
        notInConfigAccount
      );
    });

    it('should handle sandbox account selection', async () => {
      (selectAccountTypePrompt as Mock).mockResolvedValue(
        HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX
      );
      (selectSandboxTargetAccountPrompt as Mock).mockResolvedValue({
        targetAccountId: 888,
      });

      await unifiedProjectDevFlow({
        args: mockArgs,
        targetProjectAccountId: mockTargetProjectAccountId,
        projectConfig: mockProjectConfig,
        projectDir: mockProjectDir,
      });

      expect(selectSandboxTargetAccountPrompt).toHaveBeenCalled();
      expect(LocalDevProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          targetTestingAccountId: 888,
        })
      );
    });
  });

  describe('project creation', () => {
    it('should create new project when project does not exist', async () => {
      (ensureProjectExists as Mock).mockResolvedValue({
        projectExists: false,
        project: null,
      });
      (createNewProjectForLocalDev as Mock).mockResolvedValue(mockProject);
      (createInitialBuildForNewProject as Mock).mockResolvedValue({
        buildId: 456,
      });

      await unifiedProjectDevFlow({
        args: mockArgs,
        targetProjectAccountId: mockTargetProjectAccountId,
        providedTargetTestingAccountId: mockProvidedTargetTestingAccountId,
        projectConfig: mockProjectConfig,
        projectDir: mockProjectDir,
      });

      expect(createNewProjectForLocalDev).toHaveBeenCalledWith(
        mockProjectConfig,
        mockTargetProjectAccountId,
        false,
        false
      );
      expect(createInitialBuildForNewProject).toHaveBeenCalledWith(
        mockProjectConfig,
        mockProjectDir,
        mockTargetProjectAccountId,
        true,
        mockArgs.profile
      );
    });

    it('should use existing project and build when project exists', async () => {
      await unifiedProjectDevFlow({
        args: mockArgs,
        targetProjectAccountId: mockTargetProjectAccountId,
        providedTargetTestingAccountId: mockProvidedTargetTestingAccountId,
        projectConfig: mockProjectConfig,
        projectDir: mockProjectDir,
      });

      expect(createNewProjectForLocalDev).not.toHaveBeenCalled();
      expect(LocalDevProcess).toHaveBeenCalledWith(
        expect.objectContaining({
          projectData: mockProject,
        })
      );
    });
  });

  describe('local dev process setup', () => {
    it('should initialize LocalDevProcess with correct parameters', async () => {
      await unifiedProjectDevFlow({
        args: mockArgs,
        targetProjectAccountId: mockTargetProjectAccountId,
        providedTargetTestingAccountId: mockProvidedTargetTestingAccountId,
        projectConfig: mockProjectConfig,
        projectDir: mockProjectDir,
      });

      expect(LocalDevProcess).toHaveBeenCalledWith({
        initialProjectNodes: mockProjectNodes,
        debug: mockArgs.debug,
        profile: mockArgs.profile,
        targetProjectAccountId: mockTargetProjectAccountId,
        targetTestingAccountId: mockProvidedTargetTestingAccountId,
        projectConfig: mockProjectConfig,
        projectDir: mockProjectDir,
        projectData: mockProject,
        env: ENVIRONMENTS.PROD,
      });
    });

    it('should set up keypress and exit handlers', async () => {
      await unifiedProjectDevFlow({
        args: mockArgs,
        targetProjectAccountId: mockTargetProjectAccountId,
        providedTargetTestingAccountId: mockProvidedTargetTestingAccountId,
        projectConfig: mockProjectConfig,
        projectDir: mockProjectDir,
      });

      expect(handleKeypress).toHaveBeenCalledWith(expect.any(Function));
      expect(handleExit).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should start all required services', async () => {
      await unifiedProjectDevFlow({
        args: mockArgs,
        targetProjectAccountId: mockTargetProjectAccountId,
        providedTargetTestingAccountId: mockProvidedTargetTestingAccountId,
        projectConfig: mockProjectConfig,
        projectDir: mockProjectDir,
      });

      expect(mockLocalDevProcess.start).toHaveBeenCalled();
      expect(mockLocalDevWatcher.start).toHaveBeenCalled();
      expect(mockWebsocketServer.start).toHaveBeenCalled();
      expect(SpinniesManager.init).toHaveBeenCalled();
    });
  });

  describe('UI messaging', () => {
    beforeEach(() => {
      (isTestAccountOrSandbox as Mock).mockReturnValue(false);
    });

    it('should log info message when default account is a sandbox or test account', async () => {
      (isTestAccountOrSandbox as Mock).mockReturnValue(true);

      await unifiedProjectDevFlow({
        args: mockArgs,
        targetProjectAccountId: mockTargetProjectAccountId,
        projectConfig: mockProjectConfig,
        projectDir: mockProjectDir,
      });

      expect(uiLogger.log).toHaveBeenCalledWith(
        commands.project.dev.logs.defaultSandboxOrDevTestTestingAccountExplanation(
          mockTargetProjectAccountId
        )
      );
    });

    it('should log info message when testingAccount flag is provided', async () => {
      const providedTestingAccountId = 999;

      await unifiedProjectDevFlow({
        args: mockArgs,
        targetProjectAccountId: mockTargetProjectAccountId,
        providedTargetTestingAccountId: providedTestingAccountId,
        projectConfig: mockProjectConfig,
        projectDir: mockProjectDir,
      });

      expect(uiLogger.log).toHaveBeenCalledWith(
        commands.project.dev.logs.testingAccountFlagExplanation(
          providedTestingAccountId
        )
      );
    });
  });
});

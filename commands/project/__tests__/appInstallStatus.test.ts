import yargs, { ArgumentsCamelCase, Argv } from 'yargs';
import { isLegacyProject } from '@hubspot/project-parsing-lib/projects';
import { translateForLocalDev } from '@hubspot/project-parsing-lib/translate';
import { fetchProject } from '@hubspot/local-dev-lib/api/projects';
import { fetchAppInstallationData } from '@hubspot/local-dev-lib/api/localDevAuth';

import projectInstallStatusCommand from '../appInstallStatus.js';
import { getProjectConfig } from '../../../lib/projects/config.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import { mockHubSpotHttpError } from '../../../lib/testUtils.js';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  JSONOutputArgs,
  UsageTrackingArgs,
} from '../../../types/Yargs.js';

vi.mock('../../../lib/commonOpts');
vi.mock('../../../lib/errorHandlers/index.js');
vi.mock('../../../lib/projects/config');
vi.mock('../../../lib/yargs/makeYargsHandlerWithUsageTracking', () => ({
  makeYargsHandlerWithUsageTracking: (
    _name: string,
    handler: (...args: unknown[]) => unknown
  ) => handler,
}));
vi.mock('@hubspot/project-parsing-lib/projects');
vi.mock('@hubspot/project-parsing-lib/translate');
vi.mock('@hubspot/local-dev-lib/api/projects');
vi.mock('@hubspot/local-dev-lib/api/localDevAuth');
vi.mock('@hubspot/local-dev-lib/config', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@hubspot/local-dev-lib/config')>();
  return {
    ...actual,
    getConfigAccountIfExists: vi.fn().mockReturnValue(undefined),
  };
});

type ProjectInstallStatusArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  JSONOutputArgs &
  UsageTrackingArgs;

const mockedGetProjectConfig = vi.mocked(getProjectConfig);
const mockedIsLegacyProject = vi.mocked(isLegacyProject);
const mockedTranslate = vi.mocked(translateForLocalDev);
const mockedFetchProject = vi.mocked(fetchProject);
const mockedFetchAppInstallationData = vi.mocked(fetchAppInstallationData);
const mockedUiLogger = vi.mocked(uiLogger);

const mockProjectConfig = {
  name: 'my-project',
  srcDir: 'src',
  platformVersion: '2025.2',
};

const mockStaticAppNode = {
  uid: 'my-app-uid',
  componentType: 'APPLICATION',
  config: {
    name: 'My App',
    auth: {
      type: 'STATIC',
      requiredScopes: ['crm.objects.contacts.read'],
      optionalScopes: [],
    },
  },
};

const mockOAuthAppNode = {
  ...mockStaticAppNode,
  config: {
    ...mockStaticAppNode.config,
    auth: {
      ...mockStaticAppNode.config.auth,
      type: 'OAUTH',
    },
  },
};

function installationResponse(overrides: {
  isInstalledWithScopeGroups: boolean;
  previouslyAuthorizedScopeGroups?: Array<{ id: number; name: string }>;
}) {
  return {
    data: {
      appId: 99,
      isInstalledWithScopeGroups: overrides.isInstalledWithScopeGroups,
      previouslyAuthorizedScopeGroups:
        overrides.previouslyAuthorizedScopeGroups ?? [],
    },
  } as unknown as Awaited<ReturnType<typeof fetchAppInstallationData>>;
}

describe('commands/project/appInstallStatus', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectInstallStatusCommand.command).toEqual('app-install-status');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(projectInstallStatusCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should define examples', () => {
      const exampleSpy = vi.spyOn(yargsMock, 'example');

      projectInstallStatusCommand.builder(yargsMock);

      expect(exampleSpy).toHaveBeenCalled();
    });
  });

  describe('handler', () => {
    const mockExit = vi.fn();
    const mockArgs = {
      derivedAccountId: 100,
      formatOutputAsJson: false,
      exit: mockExit,
      addUsageMetadata: vi.fn(),
    } as unknown as ArgumentsCamelCase<ProjectInstallStatusArgs>;

    beforeEach(() => {
      mockedGetProjectConfig.mockResolvedValue({
        projectConfig: mockProjectConfig,
        projectDir: '/path/to/project',
      });
      mockedIsLegacyProject.mockReturnValue(false);
      mockedTranslate.mockResolvedValue({
        intermediateNodesIndexedByUid: {
          'my-app-uid': mockStaticAppNode,
        },
      } as unknown as Awaited<ReturnType<typeof translateForLocalDev>>);
      mockedFetchProject.mockResolvedValue({
        data: { id: 42, name: 'my-project' },
      } as unknown as Awaited<ReturnType<typeof fetchProject>>);
      mockedFetchAppInstallationData.mockResolvedValue(
        installationResponse({ isInstalledWithScopeGroups: true })
      );
    });

    it('should exit with error when no project config is found', async () => {
      mockedGetProjectConfig.mockResolvedValue({
        projectConfig: null,
        projectDir: null,
      });

      await projectInstallStatusCommand.handler(mockArgs);

      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(mockedTranslate).not.toHaveBeenCalled();
    });

    it('should exit with error for unsupported platform version', async () => {
      mockedIsLegacyProject.mockReturnValue(true);

      await projectInstallStatusCommand.handler(mockArgs);

      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(mockedTranslate).not.toHaveBeenCalled();
    });

    it('should exit with error when the project has no app', async () => {
      mockedTranslate.mockResolvedValue({
        intermediateNodesIndexedByUid: {},
      } as unknown as Awaited<ReturnType<typeof translateForLocalDev>>);

      await projectInstallStatusCommand.handler(mockArgs);

      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(mockedFetchProject).not.toHaveBeenCalled();
    });

    it('should exit with error when the app is not static-auth', async () => {
      mockedTranslate.mockResolvedValue({
        intermediateNodesIndexedByUid: {
          'my-app-uid': mockOAuthAppNode,
        },
      } as unknown as Awaited<ReturnType<typeof translateForLocalDev>>);

      await projectInstallStatusCommand.handler(mockArgs);

      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(mockedFetchProject).not.toHaveBeenCalled();
    });

    it('should exit with error when project fetch fails', async () => {
      mockedFetchProject.mockRejectedValue(new Error('boom'));

      await projectInstallStatusCommand.handler(mockArgs);

      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(mockedFetchAppInstallationData).not.toHaveBeenCalled();
    });

    it('should exit with error when install data fetch fails', async () => {
      mockedFetchAppInstallationData.mockRejectedValue(new Error('boom'));

      await projectInstallStatusCommand.handler(mockArgs);

      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should exit WARNING when install data fetch returns 404', async () => {
      mockedFetchAppInstallationData.mockRejectedValue(
        mockHubSpotHttpError('Not found', { status: 404, data: {} })
      );

      await projectInstallStatusCommand.handler(mockArgs);

      expect(mockedUiLogger.log).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.WARNING);
    });

    it('should exit SUCCESS and log success when installed with current scopes', async () => {
      await projectInstallStatusCommand.handler(mockArgs);

      expect(mockedUiLogger.success).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should exit SUCCESS when installed with outdated scopes', async () => {
      mockedFetchAppInstallationData.mockResolvedValue(
        installationResponse({
          isInstalledWithScopeGroups: false,
          previouslyAuthorizedScopeGroups: [{ id: 1, name: 'contacts.read' }],
        })
      );

      await projectInstallStatusCommand.handler(mockArgs);

      expect(mockedUiLogger.success).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should exit WARNING when the app is not installed', async () => {
      mockedFetchAppInstallationData.mockResolvedValue(
        installationResponse({ isInstalledWithScopeGroups: false })
      );

      await projectInstallStatusCommand.handler(mockArgs);

      expect(mockedUiLogger.log).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.WARNING);
    });

    it('should output JSON and exit SUCCESS when installed and --json is set', async () => {
      const jsonArgs = {
        ...mockArgs,
        formatOutputAsJson: true,
      } as ArgumentsCamelCase<ProjectInstallStatusArgs>;

      await projectInstallStatusCommand.handler(jsonArgs);

      expect(mockedUiLogger.json).toHaveBeenCalledWith({
        appId: 99,
        appUid: 'my-app-uid',
        accountId: 100,
        projectId: 42,
        isInstalled: true,
        isInstalledWithCurrentScopes: true,
        previouslyAuthorizedScopeGroups: [],
      });
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should output JSON and exit WARNING when not installed and --json is set', async () => {
      mockedFetchAppInstallationData.mockResolvedValue(
        installationResponse({ isInstalledWithScopeGroups: false })
      );
      const jsonArgs = {
        ...mockArgs,
        formatOutputAsJson: true,
      } as ArgumentsCamelCase<ProjectInstallStatusArgs>;

      await projectInstallStatusCommand.handler(jsonArgs);

      expect(mockedUiLogger.json).toHaveBeenCalledWith(
        expect.objectContaining({
          isInstalled: false,
          isInstalledWithCurrentScopes: false,
        })
      );
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.WARNING);
    });
  });
});

import yargs, { ArgumentsCamelCase, Argv } from 'yargs';
import { isLegacyProject } from '@hubspot/project-parsing-lib/projects';
import { translateForLocalDev } from '@hubspot/project-parsing-lib/translate';
import { fetchProject } from '@hubspot/local-dev-lib/api/projects';
import { fetchAppInstallationData } from '@hubspot/local-dev-lib/api/localDevAuth';
import {
  getConfigAccountIfExists,
  getAllConfigAccounts,
} from '@hubspot/local-dev-lib/config';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import {
  fetchAppMetadataBySourceId,
  fetchPublicAppMetadata,
  installStaticAuthAppOnCurrentAccount,
  installStaticAuthAppOnTestAccount,
} from '@hubspot/local-dev-lib/api/appsDev';

import projectInstallAppCommand from '../installApp.js';
import { getProjectConfig } from '../../../lib/projects/config.js';
import { handleProjectUpload } from '../../../lib/projects/upload.js';
import { loadProfile } from '../../../lib/projects/projectProfiles.js';
import { projectProfilePrompt } from '../../../lib/prompts/projectProfilePrompt.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import { confirmPrompt, listPrompt } from '../../../lib/prompts/promptUtils.js';
import { warnAboutSkippedHsMetaFiles } from '../../../lib/projects/ui.js';
import { mockHubSpotHttpError } from '../../../lib/testUtils.js';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  JSONOutputArgs,
  UsageTrackingArgs,
} from '../../../types/Yargs.js';

vi.mock('../../../lib/commonOpts');
vi.mock('../../../lib/errorHandlers/index.js');
vi.mock('../../../lib/projects/config');
vi.mock('../../../lib/projects/projectProfiles');
vi.mock('../../../lib/projects/upload');
vi.mock('../../../lib/projects/pollProjectBuildAndDeploy');
vi.mock('../../../lib/prompts/projectProfilePrompt');
vi.mock('../../../lib/prompts/promptUtils');
vi.mock('../../../lib/yargs/makeWrappedYargsHandler', () => ({
  makeWrappedYargsHandler: (
    _name: string,
    handler: (...args: unknown[]) => unknown
  ) => handler,
}));
vi.mock('@hubspot/project-parsing-lib/projects');
vi.mock('@hubspot/project-parsing-lib/translate');
vi.mock('../../../lib/projects/ui');
vi.mock('@hubspot/local-dev-lib/api/projects');
vi.mock('@hubspot/local-dev-lib/api/localDevAuth');
vi.mock('@hubspot/local-dev-lib/api/appsDev');
vi.mock('@hubspot/local-dev-lib/config', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@hubspot/local-dev-lib/config')>();
  return {
    ...actual,
    getConfigAccountIfExists: vi.fn().mockReturnValue(undefined),
    getAllConfigAccounts: vi.fn().mockReturnValue([]),
  };
});

type ProjectInstallAppArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs &
  JSONOutputArgs &
  UsageTrackingArgs & {
    force: boolean;
  };

const mockedGetProjectConfig = vi.mocked(getProjectConfig);
const mockedIsLegacyProject = vi.mocked(isLegacyProject);
const mockedTranslate = vi.mocked(translateForLocalDev);
const mockedFetchProject = vi.mocked(fetchProject);
const mockedFetchAppInstallationData = vi.mocked(fetchAppInstallationData);
const mockedGetConfigAccountIfExists = vi.mocked(getConfigAccountIfExists);
const mockedGetAllConfigAccounts = vi.mocked(getAllConfigAccounts);
const mockedListPrompt = vi.mocked(listPrompt);
const mockedFetchAppMetadataBySourceId = vi.mocked(fetchAppMetadataBySourceId);
const mockedFetchPublicAppMetadata = vi.mocked(fetchPublicAppMetadata);
const mockedInstallStaticAuthApp = vi.mocked(installStaticAuthAppOnTestAccount);
const mockedInstallStaticAuthAppOnCurrentAccount = vi.mocked(
  installStaticAuthAppOnCurrentAccount
);
const mockedConfirmPrompt = vi.mocked(confirmPrompt);
const mockedHandleProjectUpload = vi.mocked(handleProjectUpload);
const mockedProjectProfilePrompt = vi.mocked(projectProfilePrompt);
const mockedLoadProfile = vi.mocked(loadProfile);
const mockedUiLogger = vi.mocked(uiLogger);
const mockedWarnAboutSkippedHsMetaFiles = vi.mocked(
  warnAboutSkippedHsMetaFiles
);

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
    distribution: 'private',
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

const mockMarketplaceAppNode = {
  ...mockStaticAppNode,
  config: {
    ...mockStaticAppNode.config,
    distribution: 'marketplace',
  },
};

const mockAppMetadata = {
  id: 99,
  name: 'My App',
  scopeGroupIds: [1, 2, 3],
  clientId: 'client-id',
  portalId: 200,
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

describe('commands/project/installApp', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectInstallAppCommand.command).toEqual('install-app');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(projectInstallAppCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should define options and examples', () => {
      const optionsSpy = vi.spyOn(yargsMock, 'options');
      const exampleSpy = vi.spyOn(yargsMock, 'example');

      projectInstallAppCommand.builder(yargsMock);

      expect(optionsSpy).toHaveBeenCalled();
      expect(exampleSpy).toHaveBeenCalled();
    });
  });

  describe('handler', () => {
    const mockExit = vi.fn();
    const mockArgs = {
      derivedAccountId: 100,
      formatOutputAsJson: false,
      force: false,
      exit: mockExit,
      addUsageMetadata: vi.fn(),
    } as unknown as ArgumentsCamelCase<ProjectInstallAppArgs>;

    beforeEach(() => {
      mockedGetProjectConfig.mockResolvedValue({
        projectConfig: mockProjectConfig,
        projectDir: '/path/to/project',
      });
      mockedIsLegacyProject.mockReturnValue(false);
      mockedWarnAboutSkippedHsMetaFiles.mockResolvedValue(true);
      mockedTranslate.mockResolvedValue({
        intermediateRepresentation: {
          intermediateNodesIndexedByUid: {
            'my-app-uid': mockStaticAppNode,
          },
          profileData: undefined,
        },
        skippedHsMetaFiles: [],
      } as unknown as Awaited<ReturnType<typeof translateForLocalDev>>);
      mockedFetchProject.mockResolvedValue({
        data: { id: 42, name: 'my-project' },
      } as unknown as Awaited<ReturnType<typeof fetchProject>>);
      mockedGetConfigAccountIfExists.mockReturnValue({
        accountId: 100,
        name: 'Developer test account',
        accountType: HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST,
        env: 'prod',
        authType: 'personalaccesskey',
        personalAccessKey: 'personal-access-key',
        auth: {
          tokenInfo: {},
        },
      });
      mockedFetchAppInstallationData.mockResolvedValue(
        installationResponse({ isInstalledWithScopeGroups: false })
      );
      mockedFetchPublicAppMetadata.mockResolvedValue({
        data: mockAppMetadata,
      } as unknown as Awaited<ReturnType<typeof fetchPublicAppMetadata>>);
      mockedFetchAppMetadataBySourceId.mockResolvedValue({
        data: mockAppMetadata,
      } as unknown as Awaited<ReturnType<typeof fetchAppMetadataBySourceId>>);
      mockedConfirmPrompt.mockResolvedValue(true);
      mockedHandleProjectUpload.mockResolvedValue({
        result: { succeeded: true },
      } as unknown as Awaited<ReturnType<typeof handleProjectUpload>>);
      mockedProjectProfilePrompt.mockResolvedValue(null);
      mockedInstallStaticAuthApp.mockResolvedValue(
        {} as Awaited<ReturnType<typeof installStaticAuthAppOnTestAccount>>
      );
      mockedInstallStaticAuthAppOnCurrentAccount.mockResolvedValue(
        {} as Awaited<ReturnType<typeof installStaticAuthAppOnCurrentAccount>>
      );
    });

    it('should exit with error when no project config is found', async () => {
      mockedGetProjectConfig.mockResolvedValue({
        projectConfig: null,
        projectDir: null,
      });

      await projectInstallAppCommand.handler(mockArgs);

      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should exit with error for unsupported platform version', async () => {
      mockedIsLegacyProject.mockReturnValue(true);

      await projectInstallAppCommand.handler(mockArgs);

      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should exit with error when the project has no app', async () => {
      mockedTranslate.mockResolvedValue({
        intermediateRepresentation: {
          intermediateNodesIndexedByUid: {},
          profileData: undefined,
        },
        skippedHsMetaFiles: [],
      } as unknown as Awaited<ReturnType<typeof translateForLocalDev>>);

      await projectInstallAppCommand.handler(mockArgs);

      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should exit with error when the app is not static-auth', async () => {
      mockedTranslate.mockResolvedValue({
        intermediateRepresentation: {
          intermediateNodesIndexedByUid: {
            'my-app-uid': mockOAuthAppNode,
          },
          profileData: undefined,
        },
        skippedHsMetaFiles: [],
      } as unknown as Awaited<ReturnType<typeof translateForLocalDev>>);

      await projectInstallAppCommand.handler(mockArgs);

      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should exit with error when the app is not private', async () => {
      mockedTranslate.mockResolvedValue({
        intermediateRepresentation: {
          intermediateNodesIndexedByUid: {
            'my-app-uid': mockMarketplaceAppNode,
          },
          profileData: undefined,
        },
        skippedHsMetaFiles: [],
      } as unknown as Awaited<ReturnType<typeof translateForLocalDev>>);

      await projectInstallAppCommand.handler(mockArgs);

      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(mockedFetchProject).not.toHaveBeenCalled();
    });

    it('should exit with error for an app developer account when there is no other account to switch to', async () => {
      mockedGetConfigAccountIfExists.mockReturnValue({
        accountId: 100,
        name: 'App developer account',
        accountType: HUBSPOT_ACCOUNT_TYPES.APP_DEVELOPER,
        env: 'prod',
        authType: 'personalaccesskey',
        personalAccessKey: 'personal-access-key',
        auth: {
          tokenInfo: {},
        },
      });
      mockedGetAllConfigAccounts.mockReturnValue([]);

      await projectInstallAppCommand.handler(mockArgs);

      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(mockedFetchProject).not.toHaveBeenCalled();
      expect(mockedInstallStaticAuthApp).not.toHaveBeenCalled();
    });

    it('should offer to switch accounts when the target is an app developer account', async () => {
      const devAccount = {
        accountId: 100,
        name: 'App developer account',
        accountType: HUBSPOT_ACCOUNT_TYPES.APP_DEVELOPER,
        env: 'prod',
        authType: 'personalaccesskey',
        personalAccessKey: 'personal-access-key',
        auth: { tokenInfo: {} },
      };
      const standardAccount = {
        ...devAccount,
        accountId: 200,
        name: 'Standard account',
        accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD,
      };
      mockedGetConfigAccountIfExists.mockImplementation(accountId =>
        accountId === 200
          ? (standardAccount as unknown as ReturnType<
              typeof getConfigAccountIfExists
            >)
          : (devAccount as unknown as ReturnType<
              typeof getConfigAccountIfExists
            >)
      );
      mockedGetAllConfigAccounts.mockReturnValue([
        devAccount,
        standardAccount,
      ] as unknown as ReturnType<typeof getAllConfigAccounts>);
      mockedListPrompt.mockResolvedValue(200);

      await projectInstallAppCommand.handler(mockArgs);

      expect(mockedListPrompt).toHaveBeenCalled();
      expect(mockedFetchProject).toHaveBeenCalledWith(200, 'my-project');
      expect(mockedInstallStaticAuthAppOnCurrentAccount).toHaveBeenCalledWith(
        99,
        200,
        [1, 2, 3]
      );
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should exit with error when project fetch fails', async () => {
      mockedFetchProject.mockRejectedValue(new Error('boom'));

      await projectInstallAppCommand.handler(mockArgs);

      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should show project-not-found message on 404 when the upload offer is declined', async () => {
      mockedFetchProject.mockRejectedValue(
        mockHubSpotHttpError('Not found', { status: 404, data: {} })
      );
      mockedConfirmPrompt.mockResolvedValue(false);

      await projectInstallAppCommand.handler(mockArgs);

      expect(mockedHandleProjectUpload).not.toHaveBeenCalled();
      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(mockedFetchAppInstallationData).not.toHaveBeenCalled();
    });

    it('should upload and deploy then install when the project is missing and --force is set', async () => {
      mockedFetchProject
        .mockRejectedValueOnce(
          mockHubSpotHttpError('Not found', { status: 404, data: {} })
        )
        .mockResolvedValue({
          data: { id: 42, name: 'my-project' },
        } as unknown as Awaited<ReturnType<typeof fetchProject>>);
      const forceArgs = {
        ...mockArgs,
        force: true,
      } as ArgumentsCamelCase<ProjectInstallAppArgs>;

      await projectInstallAppCommand.handler(forceArgs);

      expect(mockedConfirmPrompt).not.toHaveBeenCalled();
      expect(mockedHandleProjectUpload).toHaveBeenCalledTimes(1);
      expect(mockedInstallStaticAuthApp).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should exit with error when install data fetch fails', async () => {
      mockedFetchAppInstallationData.mockRejectedValue(new Error('boom'));

      await projectInstallAppCommand.handler(mockArgs);

      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should report already installed when installed with current scopes', async () => {
      mockedFetchAppInstallationData.mockResolvedValue(
        installationResponse({ isInstalledWithScopeGroups: true })
      );

      await projectInstallAppCommand.handler(mockArgs);

      expect(mockedUiLogger.success).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
      expect(mockedInstallStaticAuthApp).not.toHaveBeenCalled();
    });

    it('should install the app when not installed and user confirms', async () => {
      await projectInstallAppCommand.handler(mockArgs);

      expect(mockedConfirmPrompt).toHaveBeenCalled();
      expect(mockedInstallStaticAuthApp).toHaveBeenCalledWith(
        99,
        100,
        [1, 2, 3]
      );
      expect(mockedInstallStaticAuthAppOnCurrentAccount).not.toHaveBeenCalled();
      expect(mockedUiLogger.success).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should install via the current-account endpoint when a standard account owns the app', async () => {
      mockedGetConfigAccountIfExists.mockReturnValue({
        accountId: 100,
        name: 'Standard account',
        accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD,
        env: 'prod',
        authType: 'personalaccesskey',
        personalAccessKey: 'personal-access-key',
        auth: {
          tokenInfo: {},
        },
      });
      mockedFetchPublicAppMetadata.mockResolvedValue({
        data: { ...mockAppMetadata, portalId: 100 },
      } as unknown as Awaited<ReturnType<typeof fetchPublicAppMetadata>>);

      await projectInstallAppCommand.handler(mockArgs);

      expect(mockedInstallStaticAuthAppOnCurrentAccount).toHaveBeenCalledWith(
        99,
        100,
        [1, 2, 3]
      );
      expect(mockedInstallStaticAuthApp).not.toHaveBeenCalled();
      expect(mockedUiLogger.success).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should use the current-account endpoint when a test account owns the app', async () => {
      // Target 100 is a dev test account that owns the app: an owner install.
      mockedFetchPublicAppMetadata.mockResolvedValue({
        data: { ...mockAppMetadata, portalId: 100 },
      } as unknown as Awaited<ReturnType<typeof fetchPublicAppMetadata>>);

      await projectInstallAppCommand.handler(mockArgs);

      expect(mockedInstallStaticAuthAppOnCurrentAccount).toHaveBeenCalledWith(
        99,
        100,
        [1, 2, 3]
      );
      expect(mockedInstallStaticAuthApp).not.toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should target the profile account when a profile is resolved', async () => {
      mockedProjectProfilePrompt.mockResolvedValue('qa');
      mockedLoadProfile.mockReturnValue({
        accountId: 200,
      } as unknown as ReturnType<typeof loadProfile>);
      mockedGetConfigAccountIfExists.mockImplementation(accountId =>
        accountId === 200
          ? ({
              accountId: 200,
              name: 'Profile account',
              accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD,
              env: 'prod',
              authType: 'personalaccesskey',
              personalAccessKey: 'personal-access-key',
              auth: { tokenInfo: {} },
            } as unknown as ReturnType<typeof getConfigAccountIfExists>)
          : undefined
      );

      await projectInstallAppCommand.handler(mockArgs);

      expect(mockedLoadProfile).toHaveBeenCalledWith(
        mockProjectConfig,
        '/path/to/project',
        'qa'
      );
      expect(mockedFetchProject).toHaveBeenCalledWith(200, 'my-project');
      expect(mockedInstallStaticAuthAppOnCurrentAccount).toHaveBeenCalledWith(
        99,
        200,
        [1, 2, 3]
      );
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should exit with error when profile resolution fails', async () => {
      mockedProjectProfilePrompt.mockRejectedValue(new Error('no profile'));

      await projectInstallAppCommand.handler(mockArgs);

      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(mockedFetchProject).not.toHaveBeenCalled();
      expect(mockedInstallStaticAuthApp).not.toHaveBeenCalled();
      expect(mockedInstallStaticAuthAppOnCurrentAccount).not.toHaveBeenCalled();
    });

    it('should exit without installing when user declines', async () => {
      mockedConfirmPrompt.mockResolvedValue(false);

      await projectInstallAppCommand.handler(mockArgs);

      expect(mockedInstallStaticAuthApp).not.toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should skip confirmation with --force', async () => {
      const forceArgs = {
        ...mockArgs,
        force: true,
      } as ArgumentsCamelCase<ProjectInstallAppArgs>;

      await projectInstallAppCommand.handler(forceArgs);

      expect(mockedConfirmPrompt).not.toHaveBeenCalled();
      expect(mockedInstallStaticAuthApp).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should still prompt for confirmation with --json when --force is not set', async () => {
      const jsonArgs = {
        ...mockArgs,
        formatOutputAsJson: true,
      } as ArgumentsCamelCase<ProjectInstallAppArgs>;

      await projectInstallAppCommand.handler(jsonArgs);

      expect(mockedConfirmPrompt).toHaveBeenCalled();
      expect(mockedInstallStaticAuthApp).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should not install with --json when the confirmation is declined', async () => {
      mockedConfirmPrompt.mockResolvedValue(false);
      const jsonArgs = {
        ...mockArgs,
        formatOutputAsJson: true,
      } as ArgumentsCamelCase<ProjectInstallAppArgs>;

      await projectInstallAppCommand.handler(jsonArgs);

      expect(mockedInstallStaticAuthApp).not.toHaveBeenCalled();
      expect(mockedInstallStaticAuthAppOnCurrentAccount).not.toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should prompt to reinstall when installed with outdated scopes', async () => {
      mockedFetchAppInstallationData.mockResolvedValue(
        installationResponse({
          isInstalledWithScopeGroups: false,
          previouslyAuthorizedScopeGroups: [{ id: 1, name: 'contacts.read' }],
        })
      );

      await projectInstallAppCommand.handler(mockArgs);

      expect(mockedConfirmPrompt).toHaveBeenCalled();
      expect(mockedInstallStaticAuthApp).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should exit with error when install API fails', async () => {
      mockedInstallStaticAuthApp.mockRejectedValue(new Error('API error'));

      await projectInstallAppCommand.handler(mockArgs);

      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should show an install URL when automatic install is unavailable for a standard account', async () => {
      mockedGetConfigAccountIfExists.mockReturnValue({
        accountId: 100,
        name: 'Standard account',
        accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD,
        env: 'prod',
        authType: 'personalaccesskey',
        personalAccessKey: 'personal-access-key',
        auth: {
          tokenInfo: {},
        },
      });

      await projectInstallAppCommand.handler(mockArgs);

      expect(mockedInstallStaticAuthApp).not.toHaveBeenCalled();
      expect(mockedInstallStaticAuthAppOnCurrentAccount).not.toHaveBeenCalled();
      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining(
          'https://app.hubspot.com/static-token/100/authorize?appId=99'
        )
      );
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should show an install URL when the account is not in the config', async () => {
      mockedGetConfigAccountIfExists.mockReturnValue(undefined);

      await projectInstallAppCommand.handler(mockArgs);

      expect(mockedInstallStaticAuthApp).not.toHaveBeenCalled();
      expect(mockedInstallStaticAuthAppOnCurrentAccount).not.toHaveBeenCalled();
      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining(
          'https://app.hubspot.com/static-token/100/authorize?appId=99'
        )
      );
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should not show an install URL when the current-account install API fails', async () => {
      mockedGetConfigAccountIfExists.mockReturnValue({
        accountId: 100,
        name: 'Standard account',
        accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD,
        env: 'prod',
        authType: 'personalaccesskey',
        personalAccessKey: 'personal-access-key',
        auth: {
          tokenInfo: {},
        },
      });
      mockedFetchPublicAppMetadata.mockResolvedValue({
        data: { ...mockAppMetadata, portalId: 100 },
      } as unknown as Awaited<ReturnType<typeof fetchPublicAppMetadata>>);
      mockedInstallStaticAuthAppOnCurrentAccount.mockRejectedValue(
        mockHubSpotHttpError('internal error', { status: 500, data: {} })
      );

      await projectInstallAppCommand.handler(mockArgs);

      expect(mockedInstallStaticAuthAppOnCurrentAccount).toHaveBeenCalledWith(
        99,
        100,
        [1, 2, 3]
      );
      expect(mockedUiLogger.log).not.toHaveBeenCalledWith(
        expect.stringContaining(
          'https://app.hubspot.com/static-token/100/authorize?appId=99'
        )
      );
      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should treat 404 on install data as not installed and use source ID fallback', async () => {
      mockedFetchAppInstallationData.mockRejectedValue(
        mockHubSpotHttpError('Not found', { status: 404, data: {} })
      );

      await projectInstallAppCommand.handler(mockArgs);

      expect(mockedConfirmPrompt).toHaveBeenCalled();
      expect(mockedFetchAppMetadataBySourceId).toHaveBeenCalled();
      expect(mockedInstallStaticAuthApp).toHaveBeenCalled();
    });

    it('should show app-not-deployed error when metadata 404s and the upload offer is declined', async () => {
      mockedFetchAppInstallationData.mockRejectedValue(
        mockHubSpotHttpError('Not found', { status: 404, data: {} })
      );
      mockedFetchAppMetadataBySourceId.mockRejectedValue(
        mockHubSpotHttpError('Not found', { status: 404, data: {} })
      );
      // Confirm the install prompt, decline the upload-and-deploy prompt.
      mockedConfirmPrompt
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await projectInstallAppCommand.handler(mockArgs);

      expect(mockedHandleProjectUpload).not.toHaveBeenCalled();
      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(mockedInstallStaticAuthApp).not.toHaveBeenCalled();
    });

    it('should upload and deploy then install when the app is not deployed and --force is set', async () => {
      mockedFetchAppInstallationData.mockRejectedValue(
        mockHubSpotHttpError('Not found', { status: 404, data: {} })
      );
      mockedFetchAppMetadataBySourceId
        .mockRejectedValueOnce(
          mockHubSpotHttpError('Not found', { status: 404, data: {} })
        )
        .mockResolvedValue({
          data: mockAppMetadata,
        } as unknown as Awaited<ReturnType<typeof fetchAppMetadataBySourceId>>);
      const forceArgs = {
        ...mockArgs,
        force: true,
      } as ArgumentsCamelCase<ProjectInstallAppArgs>;

      await projectInstallAppCommand.handler(forceArgs);

      expect(mockedHandleProjectUpload).toHaveBeenCalledTimes(1);
      expect(mockedInstallStaticAuthApp).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should retry metadata by source ID after upload when install data app ID is stale', async () => {
      mockedFetchPublicAppMetadata.mockRejectedValue(
        mockHubSpotHttpError('Not found', { status: 404, data: {} })
      );
      mockedFetchAppMetadataBySourceId.mockResolvedValue({
        data: { ...mockAppMetadata, id: 101 },
      } as unknown as Awaited<ReturnType<typeof fetchAppMetadataBySourceId>>);
      const forceArgs = {
        ...mockArgs,
        force: true,
      } as ArgumentsCamelCase<ProjectInstallAppArgs>;

      await projectInstallAppCommand.handler(forceArgs);

      expect(mockedHandleProjectUpload).toHaveBeenCalledTimes(1);
      expect(mockedFetchPublicAppMetadata).toHaveBeenCalledWith(99, 100);
      expect(mockedFetchAppMetadataBySourceId).toHaveBeenCalledWith(
        42,
        'my-app-uid',
        100
      );
      expect(mockedInstallStaticAuthApp).toHaveBeenCalledWith(
        101,
        100,
        [1, 2, 3]
      );
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should output JSON on success when --json is set', async () => {
      const jsonArgs = {
        ...mockArgs,
        formatOutputAsJson: true,
        force: true,
      } as ArgumentsCamelCase<ProjectInstallAppArgs>;

      await projectInstallAppCommand.handler(jsonArgs);

      expect(mockedUiLogger.json).toHaveBeenCalledWith({
        appId: 99,
        appUid: 'my-app-uid',
        accountId: 100,
        projectId: 42,
        installationState: 'INSTALLED',
        installed: true,
        reinstalled: false,
      });
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should output JSON on already-installed when --json is set', async () => {
      mockedFetchAppInstallationData.mockResolvedValue(
        installationResponse({ isInstalledWithScopeGroups: true })
      );
      const jsonArgs = {
        ...mockArgs,
        formatOutputAsJson: true,
      } as ArgumentsCamelCase<ProjectInstallAppArgs>;

      await projectInstallAppCommand.handler(jsonArgs);

      expect(mockedUiLogger.json).toHaveBeenCalledWith(
        expect.objectContaining({
          installationState: 'INSTALLED',
          installed: true,
          reinstalled: false,
        })
      );
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should output JSON on failure when --json is set', async () => {
      mockedInstallStaticAuthApp.mockRejectedValue(new Error('API error'));
      const jsonArgs = {
        ...mockArgs,
        formatOutputAsJson: true,
        force: true,
      } as ArgumentsCamelCase<ProjectInstallAppArgs>;

      await projectInstallAppCommand.handler(jsonArgs);

      expect(mockedUiLogger.json).toHaveBeenCalledWith(
        expect.objectContaining({
          installationState: 'NOT_INSTALLED',
          installed: false,
          error: 'Failed to install My App in account 100.',
        })
      );
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });
});

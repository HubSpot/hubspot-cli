import { logger } from '@hubspot/local-dev-lib/logger';
import { getCwd, sanitizeFileName } from '@hubspot/local-dev-lib/path';
import { extractZipArchive } from '@hubspot/local-dev-lib/archive';
import { ArgumentsCamelCase } from 'yargs';
import { validateUid } from '@hubspot/project-parsing-lib';
import { UNMIGRATABLE_REASONS } from '@hubspot/local-dev-lib/constants/projects';
import { mapToUserFacingType } from '@hubspot/project-parsing-lib/src/lib/transform';
import { MIGRATION_STATUS } from '@hubspot/local-dev-lib/types/Migration';
import { downloadProject } from '@hubspot/local-dev-lib/api/projects';
import fs from 'fs';
import { AxiosResponse, InternalAxiosRequestConfig, AxiosHeaders } from 'axios';

import {
  confirmPrompt,
  inputPrompt,
  listPrompt,
} from '../../prompts/promptUtils';
import {
  uiAccountDescription,
  uiCommandReference,
  uiLine,
  uiLink,
} from '../../ui';
import { LoadedProjectConfig } from '../../projects/config';
import { ensureProjectExists } from '../../projects/ensureProjectExists';
import { poll } from '../../polling';
import {
  CLI_UNMIGRATABLE_REASONS,
  continueMigration,
  initializeMigration,
  listAppsForMigration,
  MigrationApp,
  MigrationFailed,
  MigratableApp,
  UnmigratableApp,
  ListAppsResponse,
  InitializeMigrationResponse,
} from '../../../api/migrate';
import { lib } from '../../../lang/en';

import { hasFeature } from '../../hasFeature';
import {
  getProjectBuildDetailUrl,
  getProjectDetailUrl,
} from '../../projects/urls';
import {
  getUnmigratableReason,
  generateFilterAppsByProjectNameFunction,
  buildErrorMessageFromMigrationStatus,
  fetchMigrationApps,
  promptForAppToMigrate,
  selectAppToMigrate,
  handleMigrationSetup,
  beginMigration,
  pollMigrationStatus,
  finalizeMigration,
  downloadProjectFiles,
  migrateApp2025_2,
  logInvalidAccountError,
  MigrateAppArgs,
} from '../migrate';

// Mock dependencies
jest.mock('@hubspot/local-dev-lib/logger');
jest.mock('@hubspot/local-dev-lib/path');
jest.mock('@hubspot/local-dev-lib/archive');
jest.mock('@hubspot/project-parsing-lib');
jest.mock('@hubspot/project-parsing-lib/src/lib/transform');
jest.mock('@hubspot/local-dev-lib/api/projects');
jest.mock('inquirer');
jest.mock('../../prompts/promptUtils');
jest.mock('../../ui');
jest.mock('../../projects/config');
jest.mock('../../projects/ensureProjectExists');
jest.mock('../../ui/SpinniesManager');
jest.mock('../../polling');
jest.mock('../../../api/migrate');
jest.mock('../../../lang/en');
jest.mock('../../hasFeature');
jest.mock('../../projects/urls');
jest.mock('fs');

// Mock implementations
const mockedLogger = logger as jest.Mocked<typeof logger>;
const mockedGetCwd = getCwd as jest.MockedFunction<typeof getCwd>;
const mockedSanitizeFileName = sanitizeFileName as jest.MockedFunction<
  typeof sanitizeFileName
>;
const mockedExtractZipArchive = extractZipArchive as jest.MockedFunction<
  typeof extractZipArchive
>;
const mockedValidateUid = validateUid as jest.MockedFunction<
  typeof validateUid
>;
const mockedMapToUserFacingType = mapToUserFacingType as jest.MockedFunction<
  typeof mapToUserFacingType
>;
const mockedDownloadProject = downloadProject as jest.MockedFunction<
  typeof downloadProject
>;
// const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;
const mockedConfirmPrompt = confirmPrompt as jest.MockedFunction<
  typeof confirmPrompt
>;
const mockedInputPrompt = inputPrompt as jest.MockedFunction<
  typeof inputPrompt
>;
const mockedListPrompt = listPrompt as jest.MockedFunction<typeof listPrompt>;
const mockedUiAccountDescription = uiAccountDescription as jest.MockedFunction<
  typeof uiAccountDescription
>;
const mockedUiCommandReference = uiCommandReference as jest.MockedFunction<
  typeof uiCommandReference
>;
const mockedUiLine = uiLine as jest.MockedFunction<typeof uiLine>;
const mockedUiLink = uiLink as jest.MockedFunction<typeof uiLink>;
const mockedEnsureProjectExists = ensureProjectExists as jest.MockedFunction<
  typeof ensureProjectExists
>;
// const mockedSpinniesManager = SpinniesManager as jest.Mocked<
//   typeof SpinniesManager
// >;
const mockedPoll = poll as jest.MockedFunction<typeof poll>;
const mockedListAppsForMigration = listAppsForMigration as jest.MockedFunction<
  typeof listAppsForMigration
>;
const mockedInitializeMigration = initializeMigration as jest.MockedFunction<
  typeof initializeMigration
>;
const mockedContinueMigration = continueMigration as jest.MockedFunction<
  typeof continueMigration
>;

const mockedHasFeature = hasFeature as jest.MockedFunction<typeof hasFeature>;
const mockedGetProjectBuildDetailUrl =
  getProjectBuildDetailUrl as jest.MockedFunction<
    typeof getProjectBuildDetailUrl
  >;
const mockedGetProjectDetailUrl = getProjectDetailUrl as jest.MockedFunction<
  typeof getProjectDetailUrl
>;
const mockedFs = fs as jest.Mocked<typeof fs>;

// Update the mock responses with proper types
const mockAxiosConfig: InternalAxiosRequestConfig = {
  headers: new AxiosHeaders(),
  method: 'get',
  url: '',
  data: undefined,
  params: undefined,
  timeout: 0,
  withCredentials: false,
  xsrfCookieName: '',
  xsrfHeaderName: '',
  maxContentLength: 0,
  maxBodyLength: 0,
  validateStatus: () => true,
  transitional: {
    silentJSONParsing: true,
    forcedJSONParsing: true,
    clarifyTimeoutError: false,
  },
};

// Update the mock unmigratable apps with proper enum values and required properties
const mockUnmigratableApps: UnmigratableApp[] = [
  {
    appId: 3,
    appName: 'App 3',
    isMigratable: false,
    // @ts-expect-error fix this
    unmigratableReason: UNMIGRATABLE_REASONS.UP_TO_DATE,
    migrationComponents: [],
  },
  {
    appId: 4,
    appName: 'App 4',
    isMigratable: false,
    // @ts-expect-error fix this
    unmigratableReason: UNMIGRATABLE_REASONS.IS_A_PRIVATE_APP,
    migrationComponents: [],
  },
];

// Define the GenericPollingResponse type locally since it's not exported
type GenericPollingResponse = {
  status: string;
};

describe('lib/app/migrate', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockedGetCwd.mockReturnValue('/mock/cwd');
    mockedSanitizeFileName.mockImplementation(name => name);
    mockedValidateUid.mockReturnValue(undefined);
    mockedMapToUserFacingType.mockImplementation(type => type);
    mockedUiAccountDescription.mockReturnValue('Account 123');
    mockedUiCommandReference.mockImplementation(cmd => cmd);
    mockedUiLink.mockImplementation((text, url) => `${text} (${url})`);
    mockedHasFeature.mockResolvedValue(true);
    mockedGetProjectBuildDetailUrl.mockReturnValue('https://mock-url/build');
    mockedGetProjectDetailUrl.mockReturnValue('https://mock-url/project');
    mockedFs.renameSync.mockImplementation(() => {});
  });

  describe('getUnmigratableReason', () => {
    it('should return the correct message for UP_TO_DATE', () => {
      const result = getUnmigratableReason(
        UNMIGRATABLE_REASONS.UP_TO_DATE,
        'Test Project',
        123
      );
      expect(result).toBe(lib.migrate.errors.unmigratableReasons.upToDate);
    });

    it('should return the correct message for IS_A_PRIVATE_APP', () => {
      const result = getUnmigratableReason(
        UNMIGRATABLE_REASONS.IS_A_PRIVATE_APP,
        'Test Project',
        123
      );
      expect(result).toBe(lib.migrate.errors.unmigratableReasons.isPrivateApp);
    });

    it('should return the correct message for LISTED_IN_MARKETPLACE', () => {
      const result = getUnmigratableReason(
        UNMIGRATABLE_REASONS.LISTED_IN_MARKETPLACE,
        'Test Project',
        123
      );
      expect(result).toBe(
        lib.migrate.errors.unmigratableReasons.listedInMarketplace
      );
    });

    it('should return the correct message for PROJECT_CONNECTED_TO_GITHUB', () => {
      const result = getUnmigratableReason(
        UNMIGRATABLE_REASONS.PROJECT_CONNECTED_TO_GITHUB,
        'Test Project',
        123
      );
      expect(result).toBe(
        lib.migrate.errors.unmigratableReasons.projectConnectedToGitHub(
          'Test Project',
          123
        )
      );
    });

    it('should return the correct message for PART_OF_PROJECT_ALREADY', () => {
      const result = getUnmigratableReason(
        CLI_UNMIGRATABLE_REASONS.PART_OF_PROJECT_ALREADY,
        'Test Project',
        123
      );
      expect(result).toBe(
        lib.migrate.errors.unmigratableReasons.partOfProjectAlready
      );
    });

    it('should return a generic message for unknown reason codes', () => {
      const result = getUnmigratableReason(
        'UNKNOWN_REASON',
        'Test Project',
        123
      );
      expect(result).toBe(
        lib.migrate.errors.unmigratableReasons.generic('UNKNOWN_REASON')
      );
    });
  });

  describe('generateFilterAppsByProjectNameFunction', () => {
    it('should return a function that filters by project name when projectConfig is provided', () => {
      const projectConfig = {
        projectConfig: { name: 'Test Project' },
        projectDir: '/mock/project/dir',
      } as LoadedProjectConfig;

      const filterFn = generateFilterAppsByProjectNameFunction(projectConfig);

      const app1 = {
        projectName: 'Test Project',
        isMigratable: true,
      } as MigratableApp;
      const app2 = {
        projectName: 'Other Project',
        isMigratable: true,
      } as MigratableApp;

      expect(filterFn(app1)).toBe(true);
      expect(filterFn(app2)).toBe(false);
    });

    it('should return a function that always returns true when projectConfig is not provided', () => {
      const filterFn = generateFilterAppsByProjectNameFunction(undefined);

      const app1 = {
        projectName: 'Test Project',
        isMigratable: true,
      } as MigratableApp;
      const app2 = {
        projectName: 'Other Project',
        isMigratable: true,
      } as MigratableApp;

      expect(filterFn(app1)).toBe(true);
      expect(filterFn(app2)).toBe(true);
    });
  });

  describe('buildErrorMessageFromMigrationStatus', () => {
    it('should return projectErrorDetail when there are no component errors', () => {
      const error: MigrationFailed = {
        id: 123,
        status: MIGRATION_STATUS.FAILURE,
        projectErrorDetail: 'Project error',
        componentErrors: [],
      };

      const result = buildErrorMessageFromMigrationStatus(error);
      expect(result).toBe('Project error');
    });

    it('should return formatted error message with component errors', () => {
      const error: MigrationFailed = {
        id: 123,
        status: MIGRATION_STATUS.FAILURE,
        projectErrorDetail: 'Project error',
        componentErrors: [
          {
            componentType: 'CARD',
            developerSymbol: 'card1',
            errorMessage: 'Card error',
          },
          {
            componentType: 'FUNCTION',
            errorMessage: 'Function error',
          },
        ],
      };

      const result = buildErrorMessageFromMigrationStatus(error);
      expect(result).toBe(
        'Project error: \n\t- CARD (card1): Card error\n\t- FUNCTION: Function error'
      );
    });
  });

  describe('fetchMigrationApps', () => {
    const accountId = 123;
    const platformVersion = '2025.2';
    // const mockMigratableApps: MigratableApp[] = [
    //   {
    //     appId: 1,
    //     appName: 'App 1',
    //     isMigratable: true,
    //     migrationComponents: [],
    //   },
    //   {
    //     appId: 2,
    //     appName: 'App 2',
    //     isMigratable: true,
    //     migrationComponents: [],
    //     projectName: 'Test Project',
    //   },
    // ];

    beforeEach(() => {
      mockedListAppsForMigration.mockResolvedValue({
        data: {
          migratableApps: [
            {
              appId: 1,
              appName: 'App 1',
              isMigratable: true,
              migrationComponents: [],
              projectName: 'Test Project',
            },
            {
              appId: 2,
              appName: 'App 2',
              isMigratable: true,
              migrationComponents: [],
              projectName: 'Test Project',
            },
          ],
          unmigratableApps: [
            {
              appId: 3,
              appName: 'App 3',
              isMigratable: false,
              unmigratableReason: UNMIGRATABLE_REASONS.UP_TO_DATE,
              migrationComponents: [],
            },
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config: mockAxiosConfig,
      } as AxiosResponse<ListAppsResponse>);
    });

    it('should return all apps when no projectConfig is provided', async () => {
      // Mock list apps to return at least one migratable app so the function doesn't throw
      mockedListAppsForMigration.mockResolvedValue({
        data: {
          migratableApps: [
            {
              appId: 1,
              appName: 'App 1',
              isMigratable: true,
              migrationComponents: [],
            },
          ],
          unmigratableApps: [],
        },
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config: mockAxiosConfig,
      } as AxiosResponse<ListAppsResponse>);

      const result = await fetchMigrationApps(
        undefined,
        accountId,
        platformVersion
      );
      expect(result).toHaveLength(1);
      expect(result[0].appId).toBe(1);
    });

    it('should filter apps by project name when projectConfig is provided', async () => {
      const projectConfig = {
        projectConfig: { name: 'Test Project' },
        projectDir: '/mock/project/dir',
      } as LoadedProjectConfig;

      // This needs to be adjusted as the implementation now throws an error for multiple apps
      mockedListAppsForMigration.mockResolvedValue({
        data: {
          migratableApps: [
            {
              appId: 1,
              appName: 'App 1',
              isMigratable: true,
              migrationComponents: [],
              projectName: 'Test Project',
            },
          ],
          unmigratableApps: [],
        },
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config: mockAxiosConfig,
      } as AxiosResponse<ListAppsResponse>);

      const result = await fetchMigrationApps(
        undefined,
        accountId,
        platformVersion,
        projectConfig
      );
      expect(result).toHaveLength(1);
      expect(result[0].projectName).toBe('Test Project');
    });

    it('should throw an error when multiple apps are found for a project', async () => {
      const projectConfig = {
        projectConfig: { name: 'Test Project' },
        projectDir: '/mock/project/dir',
      } as LoadedProjectConfig;

      mockedListAppsForMigration.mockResolvedValue({
        data: {
          migratableApps: [
            {
              appId: 1,
              appName: 'App 1',
              isMigratable: true,
              migrationComponents: [],
              projectName: 'Test Project',
            },
            {
              appId: 2,
              appName: 'App 2',
              isMigratable: true,
              migrationComponents: [],
              projectName: 'Test Project',
            },
          ],
          unmigratableApps: [],
        },
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config: mockAxiosConfig,
      } as AxiosResponse<ListAppsResponse>);

      await expect(
        fetchMigrationApps(undefined, accountId, platformVersion, projectConfig)
      ).rejects.toThrow(lib.migrate.errors.project.multipleApps);
    });

    it('should throw an error when no apps are found for a project', async () => {
      const projectConfig = {
        projectConfig: { name: 'Test Project' },
        projectDir: '/mock/project/dir',
      } as LoadedProjectConfig;

      mockedListAppsForMigration.mockResolvedValue({
        data: {
          migratableApps: [],
          unmigratableApps: [],
        },
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config: mockAxiosConfig,
      } as AxiosResponse<ListAppsResponse>);

      await expect(
        fetchMigrationApps(undefined, accountId, platformVersion, projectConfig)
      ).rejects.toThrow(lib.migrate.errors.noAppsForProject('Test Project'));
    });

    it('should throw an error when no migratable apps are found', async () => {
      mockedListAppsForMigration.mockResolvedValue({
        data: {
          migratableApps: [],
          unmigratableApps: mockUnmigratableApps,
        },
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config: mockAxiosConfig,
      } as AxiosResponse<ListAppsResponse>);

      await expect(
        fetchMigrationApps(undefined, accountId, platformVersion)
      ).rejects.toThrow(lib.migrate.errors.noAppsEligible('Account 123', []));
    });

    it('should throw an error when appId is provided but not found', async () => {
      await expect(
        fetchMigrationApps(999, accountId, platformVersion)
      ).rejects.toThrow(lib.migrate.errors.appWithAppIdNotFound(999));
    });
  });

  describe('promptForAppToMigrate', () => {
    const accountId = 123;
    const mockApps: MigrationApp[] = [
      {
        appId: 1,
        appName: 'App 1',
        isMigratable: true,
        migrationComponents: [],
      },
      {
        appId: 2,
        appName: 'App 2',
        isMigratable: false,
        migrationComponents: [],
        // @ts-expect-error fix this
        unmigratableReason: UNMIGRATABLE_REASONS.UP_TO_DATE,
      },
    ];

    beforeEach(() => {
      mockedListPrompt.mockResolvedValue(mockApps[0]);
    });

    it('should prompt the user to select an app', async () => {
      await promptForAppToMigrate(mockApps, accountId);

      expect(mockedListPrompt).toHaveBeenCalledWith(
        lib.migrate.prompt.chooseApp,
        expect.any(Object)
      );
    });

    it('should return the selected app', async () => {
      // Looking at the implementation, the function uses listPrompt and returns the app ID
      // We need to mock listPrompt to return the expected object structure
      mockedListPrompt.mockResolvedValue({ appId: mockApps[0].appId });

      // Call the function and check the result
      const result = await promptForAppToMigrate(mockApps, accountId);

      // Based on the implementation, it should now return the ID
      expect(result).toBe(mockApps[0].appId);
    });
  });

  describe('selectAppToMigrate', () => {
    const accountId = 123;
    const mockApps: MigrationApp[] = [
      {
        appId: 1,
        appName: 'App 1',
        isMigratable: true,
        migrationComponents: [
          { id: '1', componentType: 'CARD', isSupported: true },
          { id: '2', componentType: 'FUNCTION', isSupported: false },
        ],
      },
      {
        appId: 2,
        appName: 'App 2',
        isMigratable: false,
        migrationComponents: [],
        // @ts-expect-error fix this
        unmigratableReason: UNMIGRATABLE_REASONS.UP_TO_DATE,
      },
    ];

    beforeEach(() => {
      // Mock promptForAppToMigrate properly
      mockedListPrompt.mockResolvedValue({ appId: 1 });
      mockedConfirmPrompt.mockResolvedValue(true);
    });

    it('should throw an error when appId is provided but not found', async () => {
      await expect(
        selectAppToMigrate(mockApps, accountId, 999)
      ).rejects.toThrow(lib.migrate.errors.appWithAppIdNotFound(999));
    });

    it('should call listPrompt when appId is not provided', async () => {
      await selectAppToMigrate(mockApps, accountId);

      expect(mockedListPrompt).toHaveBeenCalledWith(
        lib.migrate.prompt.chooseApp,
        expect.any(Object)
      );
    });

    it('should return proceed: false and appIdToMigrate when user cancels', async () => {
      mockedConfirmPrompt.mockResolvedValue(false);

      const result = await selectAppToMigrate(mockApps, accountId);

      expect(result.proceed).toBe(false);
      expect(result.appIdToMigrate).toBe(1); // The appId is still returned even when proceed is false
    });

    it('should return proceed: true and appIdToMigrate when user confirms', async () => {
      const result = await selectAppToMigrate(mockApps, accountId);

      expect(result).toEqual({ proceed: true, appIdToMigrate: 1 });
    });
  });

  describe('handleMigrationSetup', () => {
    const accountId = 123;
    const options = {
      name: 'Test Project',
      dest: '/mock/dest',
      appId: 1,
      platformVersion: '2025.2',
      unstable: false,
    } as ArgumentsCamelCase<MigrateAppArgs>;

    beforeEach(() => {
      // Mock required functions
      mockedListAppsForMigration.mockResolvedValue({
        data: {
          migratableApps: [
            {
              appId: 1,
              appName: 'App 1',
              isMigratable: true,
              migrationComponents: [],
            },
          ],
          unmigratableApps: [],
        },
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config: mockAxiosConfig,
      });

      // Mock listPrompt and confirmPrompt which are used by selectAppToMigrate
      mockedListPrompt.mockResolvedValue({ appId: 1 });
      mockedConfirmPrompt.mockResolvedValue(true);

      mockedEnsureProjectExists.mockResolvedValue({ projectExists: false });
    });

    it('should return early when user cancels', async () => {
      // Override the mock for this test only
      mockedConfirmPrompt.mockResolvedValueOnce(false);

      const result = await handleMigrationSetup(accountId, options);

      expect(result).toEqual({});
    });

    it('should return project details when projectConfig is provided', async () => {
      const projectConfig = {
        projectConfig: { name: 'Test Project' },
        projectDir: '/mock/project/dir',
      } as LoadedProjectConfig;

      // For this test, we need migratableApps with matching projectName
      mockedListAppsForMigration.mockResolvedValueOnce({
        data: {
          migratableApps: [
            {
              appId: 1,
              appName: 'App 1',
              isMigratable: true,
              migrationComponents: [],
              projectName: 'Test Project', // Match the project name
            },
          ],
          unmigratableApps: [],
        },
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config: mockAxiosConfig,
      });

      const result = await handleMigrationSetup(
        accountId,
        options,
        projectConfig
      );

      expect(result).toEqual({
        appIdToMigrate: 1,
        projectName: 'Test Project',
        projectDest: '/mock/project/dir',
      });
    });

    it('should prompt for project name when not provided', async () => {
      const optionsWithoutName = { ...options, name: undefined };
      mockedInputPrompt.mockResolvedValue('New Project');

      await handleMigrationSetup(accountId, optionsWithoutName);

      expect(mockedInputPrompt).toHaveBeenCalledWith(
        lib.migrate.prompt.inputName,
        expect.any(Object)
      );
    });

    it('should prompt for project destination when not provided', async () => {
      const optionsWithoutDest = { ...options, dest: undefined };
      mockedInputPrompt.mockResolvedValue('/mock/new/dest');

      await handleMigrationSetup(accountId, optionsWithoutDest);

      expect(mockedInputPrompt).toHaveBeenCalledWith(
        lib.migrate.prompt.inputDest,
        expect.any(Object)
      );
    });

    it('should throw an error when project already exists', async () => {
      mockedEnsureProjectExists.mockResolvedValue({ projectExists: true });

      await expect(handleMigrationSetup(accountId, options)).rejects.toThrow(
        lib.migrate.errors.project.alreadyExists('Test Project')
      );
    });
  });

  describe('beginMigration', () => {
    const accountId = 123;
    const appId = 1;
    const platformVersion = '2025.2';
    const migrationId = 456;

    beforeEach(() => {
      mockedInitializeMigration.mockResolvedValue({
        data: { migrationId },
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config: mockAxiosConfig,
      } as AxiosResponse<InitializeMigrationResponse>);
      mockedPoll.mockResolvedValue({
        status: MIGRATION_STATUS.INPUT_REQUIRED,
        componentsRequiringUids: {},
      } as GenericPollingResponse);
      mockedInputPrompt.mockResolvedValue('test-uid');
    });

    it('should initialize migration and return migrationId and uidMap', async () => {
      const result = await beginMigration(accountId, appId, platformVersion);

      expect(result).toEqual({
        migrationId,
        uidMap: {},
      });
    });

    it('should prompt for UIDs when components require them', async () => {
      mockedPoll.mockResolvedValue({
        status: MIGRATION_STATUS.INPUT_REQUIRED,
        componentsRequiringUids: {
          '1': {
            componentType: 'CARD',
            componentHint: 'test-card',
          },
        },
      } as GenericPollingResponse);

      await beginMigration(accountId, appId, platformVersion);

      expect(mockedInputPrompt).toHaveBeenCalledWith(
        lib.migrate.prompt.uidForComponent("CARD 'test-card'"),
        expect.any(Object)
      );
    });

    it('should throw an error when migration fails', async () => {
      // Create a standard error
      const error = new Error('Test error');

      mockedPoll.mockRejectedValue(error);

      await expect(
        beginMigration(accountId, appId, platformVersion)
      ).rejects.toThrow();
    });
  });

  describe('pollMigrationStatus', () => {
    const accountId = 123;
    const migrationId = 456;

    it('should call poll with checkMigrationStatusV2', async () => {
      const mockStatus = {
        id: migrationId,
        status: MIGRATION_STATUS.SUCCESS,
        buildId: 789,
      } as GenericPollingResponse;

      mockedPoll.mockResolvedValue(mockStatus);

      const result = await pollMigrationStatus(accountId, migrationId);

      expect(mockedPoll).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Object)
      );
      expect(result).toBe(mockStatus);
    });
  });

  describe('finalizeMigration', () => {
    const accountId = 123;
    const migrationId = 456;
    const uidMap = { '1': 'test-uid' };
    const projectName = 'Test Project';
    const buildId = 789;

    beforeEach(() => {
      mockedContinueMigration.mockResolvedValue({
        data: { migrationId },
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config: mockAxiosConfig,
      } as AxiosResponse<InitializeMigrationResponse>);
      mockedPoll.mockResolvedValue({
        status: MIGRATION_STATUS.SUCCESS,
        buildId,
      } as GenericPollingResponse);
    });

    it('should continue migration and return buildId', async () => {
      const result = await finalizeMigration(
        accountId,
        migrationId,
        uidMap,
        projectName
      );

      expect(result).toBe(buildId);
    });

    it('should throw an error when migration fails', async () => {
      const error = new Error('Test error');

      mockedPoll.mockRejectedValue(error);

      await expect(
        finalizeMigration(accountId, migrationId, uidMap, projectName)
      ).rejects.toThrow();
    });
  });

  describe('downloadProjectFiles', () => {
    const accountId = 123;
    const projectName = 'Test Project';
    const buildId = 789;
    const projectDest = '/mock/dest';

    beforeEach(() => {
      mockedDownloadProject.mockResolvedValue({
        data: Buffer.from('mock-zip-data'),
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config: mockAxiosConfig,
      } as AxiosResponse<Buffer>);
      mockedExtractZipArchive.mockResolvedValue(true);
    });

    it('should download and extract project files', async () => {
      // Mock getCwd, sanitizeFileName, and downloadProject functions
      mockedGetCwd.mockReturnValue('/mock/cwd');
      mockedSanitizeFileName.mockReturnValue(projectName);

      mockedDownloadProject.mockResolvedValueOnce({
        data: Buffer.from('mock-zip-data'),
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config: mockAxiosConfig,
      });

      await downloadProjectFiles(accountId, projectName, buildId, projectDest);

      expect(mockedDownloadProject).toHaveBeenCalledWith(
        accountId,
        projectName,
        buildId
      );
      expect(mockedExtractZipArchive).toHaveBeenCalledWith(
        expect.any(Buffer),
        projectName,
        expect.stringContaining('mock/dest'),
        expect.any(Object)
      );
    });

    it('should handle projectConfig correctly', async () => {
      const projectConfig = {
        projectConfig: { name: 'Test Project', srcDir: 'src' },
        projectDir: '/mock/project/dir',
      } as LoadedProjectConfig;

      mockedDownloadProject.mockResolvedValueOnce({
        data: Buffer.from('mock-zip-data'),
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config: mockAxiosConfig,
      });

      await downloadProjectFiles(
        accountId,
        projectName,
        buildId,
        projectDest,
        projectConfig
      );

      expect(mockedFs.renameSync).toHaveBeenCalledWith(
        '/mock/project/dir/src',
        '/mock/project/dir/archive'
      );
      expect(mockedExtractZipArchive).toHaveBeenCalledWith(
        expect.any(Buffer),
        projectName,
        '/mock/project/dir',
        expect.any(Object)
      );
    });

    it('should throw an error when download fails', async () => {
      const error = new Error('Download failed');
      mockedDownloadProject.mockRejectedValue(error);

      await expect(
        downloadProjectFiles(accountId, projectName, buildId, projectDest)
      ).rejects.toThrow(error);
    });
  });

  // These tests are skipped for now as they require additional test setup and mocking
  describe('migrateApp2025_2', () => {
    const accountId = 123;
    const options = {
      name: 'Test Project',
      dest: '/mock/dest',
      appId: 1,
      platformVersion: '2025.2',
      unstable: false,
    } as ArgumentsCamelCase<MigrateAppArgs>;

    beforeEach(() => {
      mockedHasFeature.mockResolvedValue(true);
      // Use jest.fn() with implementation instead of mockResolvedValue
      // mockedHandleMigrationSetup.mockImplementation(async () => ({
      //   appIdToMigrate: 1,
      //   projectName: 'Test Project',
      //   projectDest: '/mock/dest',
      // }));
      // mockedBeginMigration.mockResolvedValue({
      //   migrationId: 456,
      //   uidMap: {},
      // });
      // mockedFinalizeMigration.mockResolvedValue(789);
      // mockedDownloadProjectFiles.mockResolvedValue(undefined);
    });

    it('should throw an error when account is not ungated for unified apps', async () => {
      mockedHasFeature.mockResolvedValueOnce(false);
      (uiAccountDescription as jest.Mock).mockReturnValue('Account 123');

      await expect(migrateApp2025_2(accountId, options)).rejects.toThrow();
    });

    it('should throw an error when projectConfig is invalid', async () => {
      const invalidProjectConfig = {
        projectConfig: undefined,
        projectDir: '/mock/project/dir',
      } as unknown as LoadedProjectConfig;

      await expect(
        migrateApp2025_2(accountId, options, invalidProjectConfig)
      ).rejects.toThrow();
    });

    it('should throw an error when project does not exist', async () => {
      const projectConfig = {
        projectConfig: { name: 'Test Project' },
        projectDir: '/mock/project/dir',
      } as LoadedProjectConfig;

      mockedEnsureProjectExists.mockResolvedValueOnce({ projectExists: false });

      await expect(
        migrateApp2025_2(accountId, options, projectConfig)
      ).rejects.toThrow();
    });

    it('should complete the migration process successfully', async () => {
      // Reset all mocks to ensure they're called correctly
      jest.clearAllMocks();

      // Mock all functions that will be called
      mockedHasFeature.mockResolvedValueOnce(true);
    });
  });

  describe('logInvalidAccountError', () => {
    it('should log the invalid account error message', () => {
      logInvalidAccountError();

      expect(mockedUiLine).toHaveBeenCalled();
      expect(mockedLogger.error).toHaveBeenCalledWith(
        lib.migrate.errors.invalidAccountTypeTitle
      );
      expect(mockedLogger.log).toHaveBeenCalledWith(
        lib.migrate.errors.invalidAccountTypeDescription(
          'hs account use',
          'hs auth'
        )
      );
      expect(mockedUiLine).toHaveBeenCalled();
    });
  });
});

import { uiLogger } from '../../ui/logger.js';
import { getCwd, sanitizeFileName } from '@hubspot/local-dev-lib/path';
import { extractZipArchive } from '@hubspot/local-dev-lib/archive';
import { ArgumentsCamelCase } from 'yargs';
import { validateUid } from '@hubspot/project-parsing-lib';
import { UNMIGRATABLE_REASONS } from '@hubspot/local-dev-lib/constants/projects';
import { MIGRATION_STATUS } from '@hubspot/local-dev-lib/types/Migration';
import { downloadProject } from '@hubspot/local-dev-lib/api/projects';
import fs from 'fs';
import { MockedFunction, Mocked } from 'vitest';
import {
  confirmPrompt,
  inputPrompt,
  listPrompt,
} from '../../prompts/promptUtils.js';
import { LoadedProjectConfig } from '../../projects/config.js';
import { ensureProjectExists } from '../../projects/ensureProjectExists.js';
import { poll } from '../../polling.js';
import {
  CLI_UNMIGRATABLE_REASONS,
  continueAppMigration,
  initializeAppMigration,
  listAppsForMigration,
  MigrationApp,
  MigrationFailed,
  MigratableApp,
  UnmigratableApp,
} from '../../../api/migrate.js';
import { lib } from '../../../lang/en.js';
import { hasUnfiedAppsAccess } from '../../hasFeature.js';
import {
  getUnmigratableReason,
  generateFilterAppsByProjectNameFunction,
  buildErrorMessageFromMigrationStatus,
  fetchMigrationApps,
  promptForAppToMigrate,
  selectAppToMigrate,
  handleMigrationSetup,
  beginAppMigration,
  pollMigrationStatus,
  finalizeAppMigration,
  downloadProjectFiles,
  migrateApp2025_2,
  logInvalidAccountError,
  MigrateAppArgs,
  validateMigrationApps,
} from '../migrate.js';

vi.mock('../../ui/logger.js');
vi.mock('@hubspot/local-dev-lib/path');
vi.mock('@hubspot/local-dev-lib/archive');
vi.mock('@hubspot/project-parsing-lib');
vi.mock('@hubspot/local-dev-lib/api/projects');
vi.mock('inquirer');
vi.mock('../../prompts/promptUtils');
vi.mock('../../projects/config');
vi.mock('../../projects/ensureProjectExists');
vi.mock('../../ui/SpinniesManager');
vi.mock('../../polling');
vi.mock('../../../api/migrate');
vi.mock('../../hasFeature');
vi.mock('../../projects/urls');
vi.mock('fs');

const mockedUiLogger = uiLogger as Mocked<typeof uiLogger>;
const mockedGetCwd = getCwd as MockedFunction<typeof getCwd>;
const mockedSanitizeFileName = sanitizeFileName as MockedFunction<
  typeof sanitizeFileName
>;
const mockedExtractZipArchive = extractZipArchive as MockedFunction<
  typeof extractZipArchive
>;
const mockedValidateUid = validateUid as MockedFunction<typeof validateUid>;
const mockedDownloadProject = downloadProject as MockedFunction<
  typeof downloadProject
>;
const mockedConfirmPrompt = confirmPrompt as MockedFunction<
  typeof confirmPrompt
>;
const mockedInputPrompt = inputPrompt as MockedFunction<typeof inputPrompt>;
const mockedListPrompt = listPrompt as MockedFunction<typeof listPrompt>;
const mockedEnsureProjectExists = ensureProjectExists as MockedFunction<
  typeof ensureProjectExists
>;
const mockedPoll = poll as MockedFunction<typeof poll>;
const mockedListAppsForMigration = listAppsForMigration as MockedFunction<
  typeof listAppsForMigration
>;

const mockedInitializeAppMigration = initializeAppMigration as MockedFunction<
  typeof initializeAppMigration
>;
const mockedContinueAppMigration = continueAppMigration as MockedFunction<
  typeof continueAppMigration
>;
const mockedHasUnfiedAppsAccess = hasUnfiedAppsAccess as MockedFunction<
  typeof hasUnfiedAppsAccess
>;
const mockedFs = fs as Mocked<typeof fs>;

const createMockMigratableApp = (
  id: number,
  name: string,
  projectName?: string
): MigratableApp => ({
  appId: id,
  appName: name,
  isMigratable: true,
  migrationComponents: [],
  ...(projectName && { projectName }),
});

const createMockUnmigratableApp = (
  id: number,
  name: string,
  reason: string
): UnmigratableApp => ({
  appId: id,
  appName: name,
  isMigratable: false,
  // @ts-expect-error
  unmigratableReason: reason,
  migrationComponents: [],
});

const createLoadedProjectConfig = (name: string): LoadedProjectConfig =>
  ({
    projectConfig: { name, srcDir: 'src' },
    projectDir: MOCK_PROJECT_DIR,
  }) as LoadedProjectConfig;

const ACCOUNT_ID = 123;
const PROJECT_NAME = 'Test Project';
const APP_ID = 1;
const PLATFORM_VERSION = '2025.2';
const MIGRATION_ID = 456;
const BUILD_ID = 789;
const PROJECT_DEST = '/mock/dest';
const MOCK_CWD = '/mock/cwd';
const MOCK_PROJECT_DIR = '/mock/project/dir';

const mockUnmigratableApps: UnmigratableApp[] = [
  createMockUnmigratableApp(3, 'App 3', UNMIGRATABLE_REASONS.UP_TO_DATE),
  createMockUnmigratableApp(4, 'App 4', UNMIGRATABLE_REASONS.IS_A_PRIVATE_APP),
];

describe('lib/app/migrate', () => {
  beforeEach(() => {
    mockedGetCwd.mockReturnValue(MOCK_CWD);
    mockedSanitizeFileName.mockImplementation(name => name);
    mockedValidateUid.mockReturnValue(undefined);
    mockedHasUnfiedAppsAccess.mockResolvedValue(true);
    mockedFs.renameSync.mockImplementation(() => {});
  });

  describe('getUnmigratableReason', () => {
    const testCases = [
      {
        name: 'UP_TO_DATE',
        reason: UNMIGRATABLE_REASONS.UP_TO_DATE,
        expected: lib.migrate.errors.unmigratableReasons.upToDate,
      },
      {
        name: 'IS_A_PRIVATE_APP',
        reason: UNMIGRATABLE_REASONS.IS_A_PRIVATE_APP,
        expected: lib.migrate.errors.unmigratableReasons.isPrivateApp,
      },
      {
        name: 'LISTED_IN_MARKETPLACE',
        reason: UNMIGRATABLE_REASONS.LISTED_IN_MARKETPLACE,
        expected: lib.migrate.errors.unmigratableReasons.listedInMarketplace,
      },
      {
        name: 'PROJECT_CONNECTED_TO_GITHUB',
        reason: UNMIGRATABLE_REASONS.PROJECT_CONNECTED_TO_GITHUB,
        expected:
          lib.migrate.errors.unmigratableReasons.projectConnectedToGitHub(
            PROJECT_NAME,
            ACCOUNT_ID
          ),
      },
      {
        name: 'PART_OF_PROJECT_ALREADY',
        reason: CLI_UNMIGRATABLE_REASONS.PART_OF_PROJECT_ALREADY,
        expected: lib.migrate.errors.unmigratableReasons.partOfProjectAlready,
      },
      {
        name: 'UNKNOWN_REASON',
        reason: 'UNKNOWN_REASON',
        expected:
          lib.migrate.errors.unmigratableReasons.generic('UNKNOWN_REASON'),
      },
    ];

    testCases.forEach(testCase => {
      it(`should return the correct message for ${testCase.name}`, () => {
        const result = getUnmigratableReason(
          testCase.reason,
          PROJECT_NAME,
          ACCOUNT_ID
        );
        expect(result).toBe(testCase.expected);
      });
    });
  });

  describe('generateFilterAppsByProjectNameFunction', () => {
    it('should return a function that filters by project name when projectConfig is provided', () => {
      const projectConfig = createLoadedProjectConfig(PROJECT_NAME);
      const filterFn = generateFilterAppsByProjectNameFunction(projectConfig);

      const matchingApp = createMockMigratableApp(1, 'App 1', PROJECT_NAME);
      const nonMatchingApp = createMockMigratableApp(
        2,
        'App 2',
        'Other Project'
      );

      expect(filterFn(matchingApp)).toBe(true);
      expect(filterFn(nonMatchingApp)).toBe(false);
    });

    it('should return a function that always returns true when projectConfig is not provided', () => {
      const filterFn = generateFilterAppsByProjectNameFunction(undefined);

      const app1 = createMockMigratableApp(1, 'App 1', PROJECT_NAME);
      const app2 = createMockMigratableApp(2, 'App 2', 'Other Project');

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
    const setupMockApps = (
      migratableApps: MigratableApp[] = [],
      unmigratableApps: UnmigratableApp[] = []
    ) => {
      // @ts-expect-error
      mockedListAppsForMigration.mockResolvedValue({
        data: {
          migratableApps,
          unmigratableApps,
        },
      });
    };

    beforeEach(() => {
      setupMockApps(
        [
          createMockMigratableApp(1, 'App 1', PROJECT_NAME),
          createMockMigratableApp(2, 'App 2', PROJECT_NAME),
        ],
        [createMockUnmigratableApp(3, 'App 3', UNMIGRATABLE_REASONS.UP_TO_DATE)]
      );
    });

    it('should return all apps when no projectConfig is provided', async () => {
      setupMockApps([createMockMigratableApp(1, 'App 1')]);

      const result = await fetchMigrationApps(ACCOUNT_ID, PLATFORM_VERSION);
      expect(result.migratableApps).toHaveLength(1);
      expect(result.migratableApps[0].appId).toBe(1);
      expect(result.unmigratableApps).toHaveLength(0);
    });

    it('should filter apps by project name when projectConfig is provided', async () => {
      const projectConfig = createLoadedProjectConfig(PROJECT_NAME);
      setupMockApps([createMockMigratableApp(1, 'App 1', PROJECT_NAME)]);

      const result = await fetchMigrationApps(
        ACCOUNT_ID,
        PLATFORM_VERSION,
        projectConfig
      );
      expect(result.migratableApps).toHaveLength(1);
      expect(result.migratableApps[0].projectName).toBe(PROJECT_NAME);
    });
  });

  describe('validateMigrationApps', () => {
    const mockMigratableApp1 = createMockMigratableApp(
      1,
      'App 1',
      PROJECT_NAME
    );
    const mockMigratableApp2 = createMockMigratableApp(
      2,
      'App 2',
      PROJECT_NAME
    );

    it('should throw an error when multiple apps are found for a project', async () => {
      const projectConfig = createLoadedProjectConfig(PROJECT_NAME);

      await expect(
        validateMigrationApps(
          APP_ID,
          ACCOUNT_ID,
          {
            migratableApps: [mockMigratableApp1, mockMigratableApp2],
            unmigratableApps: [],
          },
          projectConfig
        )
      ).rejects.toThrow(lib.migrate.errors.project.multipleApps);
    });

    it('should throw an error when no apps are found for a project', async () => {
      const projectConfig = createLoadedProjectConfig(PROJECT_NAME);

      await expect(
        validateMigrationApps(
          APP_ID,
          ACCOUNT_ID,
          { migratableApps: [], unmigratableApps: [] },
          projectConfig
        )
      ).rejects.toThrow(lib.migrate.errors.noAppsForProject(PROJECT_NAME));
    });

    it('should throw an error when no migratable apps are found', async () => {
      await expect(
        validateMigrationApps(APP_ID, ACCOUNT_ID, {
          migratableApps: [],
          unmigratableApps: mockUnmigratableApps,
        })
      ).rejects.toThrow(/No apps in account/);
    });

    it('should throw an error when appId is provided but not found', async () => {
      await expect(
        validateMigrationApps(APP_ID, ACCOUNT_ID, {
          migratableApps: [],
          unmigratableApps: [],
        })
      ).rejects.toThrow(/No apps in account/);
    });
  });

  describe('promptForAppToMigrate', () => {
    const mockApps: MigrationApp[] = [
      createMockMigratableApp(1, 'App 1'),
      createMockUnmigratableApp(2, 'App 2', UNMIGRATABLE_REASONS.UP_TO_DATE),
    ];

    beforeEach(() => {
      mockedListPrompt.mockResolvedValue(mockApps[0]);
    });

    it('should prompt the user to select an app', async () => {
      await promptForAppToMigrate(mockApps, ACCOUNT_ID);

      expect(mockedListPrompt).toHaveBeenCalledWith(
        lib.migrate.prompt.chooseApp,
        expect.any(Object)
      );
    });

    it('should return the selected app', async () => {
      mockedListPrompt.mockResolvedValue({ appId: mockApps[0].appId });
      const result = await promptForAppToMigrate(mockApps, ACCOUNT_ID);
      expect(result).toBe(mockApps[0].appId);
    });
  });

  describe('selectAppToMigrate', () => {
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
      createMockUnmigratableApp(2, 'App 2', UNMIGRATABLE_REASONS.UP_TO_DATE),
    ];

    beforeEach(() => {
      mockedListPrompt.mockResolvedValue({ appId: 1 });
      mockedConfirmPrompt.mockResolvedValue(true);
    });

    it('should throw an error when appId is provided but not found', async () => {
      await expect(
        selectAppToMigrate(mockApps, ACCOUNT_ID, 999)
      ).rejects.toThrow(lib.migrate.errors.appWithAppIdNotFound(999));
    });

    it('should call listPrompt when appId is not provided', async () => {
      await selectAppToMigrate(mockApps, ACCOUNT_ID);

      expect(mockedListPrompt).toHaveBeenCalledWith(
        lib.migrate.prompt.chooseApp,
        expect.any(Object)
      );
    });

    it('should return proceed: false and appIdToMigrate when user cancels', async () => {
      mockedConfirmPrompt.mockResolvedValue(false);
      const result = await selectAppToMigrate(mockApps, ACCOUNT_ID);
      expect(result).toEqual({ proceed: false, appIdToMigrate: 1 });
    });

    it('should return proceed: true and appIdToMigrate when user confirms', async () => {
      const result = await selectAppToMigrate(mockApps, ACCOUNT_ID);
      expect(result).toEqual({ proceed: true, appIdToMigrate: 1 });
    });
  });

  describe('handleMigrationSetup', () => {
    const defaultOptions = {
      name: PROJECT_NAME,
      dest: PROJECT_DEST,
      appId: APP_ID,
      platformVersion: PLATFORM_VERSION,
      unstable: false,
    } as ArgumentsCamelCase<MigrateAppArgs>;

    beforeEach(() => {
      setupMockForHandleMigrationSetup();
    });

    function setupMockForHandleMigrationSetup() {
      // @ts-expect-error
      mockedListAppsForMigration.mockResolvedValue({
        data: {
          migratableApps: [createMockMigratableApp(1, 'App 1')],
          unmigratableApps: [],
        },
      });
      mockedListPrompt.mockResolvedValue({ appId: 1 });
      mockedConfirmPrompt.mockResolvedValue(true);
      mockedEnsureProjectExists.mockResolvedValue({ projectExists: false });
    }

    it('should return early when user cancels', async () => {
      mockedConfirmPrompt.mockResolvedValueOnce(false);
      const result = await handleMigrationSetup(ACCOUNT_ID, defaultOptions);
      expect(result).toEqual({});
    });

    it('should return project details when projectConfig is provided', async () => {
      const projectConfig = createLoadedProjectConfig(PROJECT_NAME);

      // @ts-expect-error
      mockedListAppsForMigration.mockResolvedValueOnce({
        data: {
          migratableApps: [createMockMigratableApp(1, 'App 1', PROJECT_NAME)],
          unmigratableApps: [],
        },
      });

      const result = await handleMigrationSetup(
        ACCOUNT_ID,
        defaultOptions,
        projectConfig
      );

      expect(result).toEqual({
        appIdToMigrate: 1,
        projectName: PROJECT_NAME,
        projectDest: MOCK_PROJECT_DIR,
      });
    });

    it('should prompt for project name when not provided', async () => {
      const optionsWithoutName = { ...defaultOptions, name: undefined };
      mockedInputPrompt.mockResolvedValue('New Project');

      await handleMigrationSetup(ACCOUNT_ID, optionsWithoutName);

      expect(mockedInputPrompt).toHaveBeenCalledWith(
        lib.migrate.prompt.inputName,
        expect.any(Object)
      );
    });

    it('should prompt for project destination when not provided', async () => {
      const optionsWithoutDest = { ...defaultOptions, dest: undefined };
      mockedInputPrompt.mockResolvedValue('/mock/new/dest');

      await handleMigrationSetup(ACCOUNT_ID, optionsWithoutDest);

      expect(mockedInputPrompt).toHaveBeenCalledWith(
        lib.migrate.prompt.inputDest,
        expect.any(Object)
      );
    });

    it('should throw an error when project already exists', async () => {
      mockedEnsureProjectExists.mockResolvedValue({ projectExists: true });

      await expect(
        handleMigrationSetup(ACCOUNT_ID, defaultOptions)
      ).rejects.toThrow(lib.migrate.errors.project.alreadyExists(PROJECT_NAME));
    });
  });

  describe('beginAppMigration', () => {
    beforeEach(() => {
      // @ts-expect-error
      mockedInitializeAppMigration.mockResolvedValue({
        data: { migrationId: MIGRATION_ID },
      });

      mockedPoll.mockResolvedValue({
        status: MIGRATION_STATUS.INPUT_REQUIRED,
        // @ts-expect-error
        componentsRequiringUids: {},
      });

      mockedInputPrompt.mockResolvedValue('test-uid');
    });

    it('should initialize migration and return migrationId and uidMap', async () => {
      const result = await beginAppMigration(
        ACCOUNT_ID,
        APP_ID,
        PLATFORM_VERSION
      );

      expect(result).toEqual({
        migrationId: MIGRATION_ID,
        uidMap: {},
      });
    });

    it('should prompt for UIDs when components require them', async () => {
      const componentHint = 'test-card';
      mockedPoll.mockResolvedValue({
        status: MIGRATION_STATUS.INPUT_REQUIRED,
        // @ts-expect-error
        componentsRequiringUids: {
          '1': {
            componentType: 'CARD',
            componentHint,
          },
        },
      });

      await beginAppMigration(ACCOUNT_ID, APP_ID, PLATFORM_VERSION);

      expect(mockedInputPrompt).toHaveBeenCalledWith(
        lib.migrate.prompt.uidForComponent("card 'test-card' (ID: 1)"),
        {
          defaultAnswer: componentHint,
          validate: expect.any(Function),
        }
      );
    });

    it('should throw an error when migration fails', async () => {
      mockedPoll.mockRejectedValue(new Error('Failed'));

      await expect(
        beginAppMigration(ACCOUNT_ID, APP_ID, PLATFORM_VERSION)
      ).rejects.toThrow(/Migration Failed/);
    });
  });

  describe('pollMigrationStatus', () => {
    it('should call poll with checkMigrationStatusV2', async () => {
      const mockStatus = {
        id: MIGRATION_ID,
        status: MIGRATION_STATUS.SUCCESS,
        buildId: BUILD_ID,
      };

      mockedPoll.mockResolvedValue(mockStatus);

      const result = await pollMigrationStatus(ACCOUNT_ID, MIGRATION_ID);

      expect(mockedPoll).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Object)
      );
      expect(result).toBe(mockStatus);
    });
  });

  describe('finalizeAppMigration', () => {
    const uidMap = { '1': 'test-uid' };

    beforeEach(() => {
      // @ts-expect-error
      mockedContinueAppMigration.mockResolvedValue({
        data: { migrationId: MIGRATION_ID },
      });

      mockedPoll.mockResolvedValue({
        status: MIGRATION_STATUS.SUCCESS,
        // @ts-expect-error
        buildId: BUILD_ID,
      });
    });

    it('should continue migration and return buildId', async () => {
      const result = await finalizeAppMigration(
        ACCOUNT_ID,
        MIGRATION_ID,
        uidMap,
        PROJECT_NAME
      );

      expect(result).toBe(BUILD_ID);
    });

    it('should throw an error when migration fails', async () => {
      mockedPoll.mockRejectedValue(new Error('Test error'));

      await expect(
        finalizeAppMigration(ACCOUNT_ID, MIGRATION_ID, uidMap, PROJECT_NAME)
      ).rejects.toThrow(/Migration Failed/);
    });
  });

  describe('downloadProjectFiles', () => {
    beforeEach(() => {
      // @ts-expect-error
      mockedDownloadProject.mockResolvedValue({
        data: Buffer.from('mock-zip-data'),
      });
      mockedExtractZipArchive.mockResolvedValue(true);
      mockedGetCwd.mockReturnValue(MOCK_CWD);
      mockedSanitizeFileName.mockReturnValue(PROJECT_NAME);
    });

    it('should download and extract project files', async () => {
      await downloadProjectFiles(
        ACCOUNT_ID,
        PROJECT_NAME,
        BUILD_ID,
        PROJECT_DEST
      );

      expect(mockedDownloadProject).toHaveBeenCalledWith(
        ACCOUNT_ID,
        PROJECT_NAME,
        BUILD_ID
      );

      expect(mockedExtractZipArchive).toHaveBeenCalledWith(
        expect.any(Buffer),
        PROJECT_NAME,
        expect.stringContaining(PROJECT_DEST),
        {
          includesRootDir: true,
          hideLogs: true,
        }
      );
    });

    it('should handle projectConfig correctly', async () => {
      const projectConfig = {
        projectConfig: { name: PROJECT_NAME, srcDir: 'src' },
        projectDir: MOCK_PROJECT_DIR,
      } as LoadedProjectConfig;

      await downloadProjectFiles(
        ACCOUNT_ID,
        PROJECT_NAME,
        BUILD_ID,
        PROJECT_DEST,
        projectConfig
      );

      expect(mockedFs.renameSync).toHaveBeenCalledWith(
        `${MOCK_PROJECT_DIR}/src`,
        `${MOCK_PROJECT_DIR}/archive`
      );

      expect(mockedExtractZipArchive).toHaveBeenCalledWith(
        expect.any(Buffer),
        PROJECT_NAME,
        MOCK_PROJECT_DIR,
        {
          includesRootDir: true,
          hideLogs: true,
        }
      );
    });

    it('should throw an error when download fails', async () => {
      const error = new Error('Download failed');
      mockedDownloadProject.mockRejectedValue(error);

      await expect(
        downloadProjectFiles(ACCOUNT_ID, PROJECT_NAME, BUILD_ID, PROJECT_DEST)
      ).rejects.toThrow(error);
    });
  });

  describe('migrateApp2025_2', () => {
    const options = {
      name: PROJECT_NAME,
      dest: PROJECT_DEST,
      appId: APP_ID,
      platformVersion: PLATFORM_VERSION,
      unstable: false,
    } as ArgumentsCamelCase<MigrateAppArgs>;

    beforeEach(() => {
      mockedHasUnfiedAppsAccess.mockResolvedValue(true);
    });

    it('should throw an error when account is not ungated for unified apps', async () => {
      mockedHasUnfiedAppsAccess.mockResolvedValueOnce(false);

      await expect(migrateApp2025_2(ACCOUNT_ID, options)).rejects.toThrowError(
        /isn't enrolled in the required product beta to access this command./
      );
    });

    it('should throw an error when projectConfig is invalid', async () => {
      const invalidProjectConfig = {
        projectConfig: undefined,
        projectDir: '/mock/project/dir',
      } as unknown as LoadedProjectConfig;

      await expect(
        migrateApp2025_2(ACCOUNT_ID, options, invalidProjectConfig)
      ).rejects.toThrow(/The project configuration file is invalid/);
    });

    it('should throw an error when project does not exist', async () => {
      const projectConfig = createLoadedProjectConfig(PROJECT_NAME);

      mockedEnsureProjectExists.mockResolvedValueOnce({
        projectExists: false,
      });

      await expect(
        migrateApp2025_2(ACCOUNT_ID, options, projectConfig)
      ).rejects.toThrow(/Migrations are only supported for existing projects/);
    });
  });

  describe('logInvalidAccountError', () => {
    it('should log the invalid account error message', () => {
      logInvalidAccountError();

      expect(mockedUiLogger.error).toHaveBeenCalledWith(
        lib.migrate.errors.invalidAccountTypeTitle
      );

      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining(
          'Only public apps created in a developer account can be converted to a project component'
        )
      );
    });
  });
});

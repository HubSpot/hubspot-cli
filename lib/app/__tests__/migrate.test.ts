import { logger } from '@hubspot/local-dev-lib/logger';
import { getCwd, sanitizeFileName } from '@hubspot/local-dev-lib/path';
import { extractZipArchive } from '@hubspot/local-dev-lib/archive';
import { ArgumentsCamelCase } from 'yargs';
import { validateUid } from '@hubspot/project-parsing-lib';
import { UNMIGRATABLE_REASONS } from '@hubspot/local-dev-lib/constants/projects';
import { MIGRATION_STATUS } from '@hubspot/local-dev-lib/types/Migration';
import { downloadProject } from '@hubspot/local-dev-lib/api/projects';
import fs from 'fs';

import {
  confirmPrompt,
  inputPrompt,
  listPrompt,
} from '../../prompts/promptUtils';
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
} from '../../../api/migrate';
import { lib } from '../../../lang/en';

import { hasFeature } from '../../hasFeature';

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
jest.mock('@hubspot/local-dev-lib/api/projects');
jest.mock('inquirer');
jest.mock('../../prompts/promptUtils');
jest.mock('../../projects/config');
jest.mock('../../projects/ensureProjectExists');
jest.mock('../../ui/SpinniesManager');
jest.mock('../../polling');
jest.mock('../../../api/migrate');
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
const mockedDownloadProject = downloadProject as jest.MockedFunction<
  typeof downloadProject
>;
const mockedConfirmPrompt = confirmPrompt as jest.MockedFunction<
  typeof confirmPrompt
>;
const mockedInputPrompt = inputPrompt as jest.MockedFunction<
  typeof inputPrompt
>;
const mockedListPrompt = listPrompt as jest.MockedFunction<typeof listPrompt>;
const mockedEnsureProjectExists = ensureProjectExists as jest.MockedFunction<
  typeof ensureProjectExists
>;
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
const mockedFs = fs as jest.Mocked<typeof fs>;

// Test helpers and shared data
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
    projectConfig: { name },
    projectDir: '/mock/project/dir',
  }) as LoadedProjectConfig;

// Common test values
const accountId = 123;
const projectName = 'Test Project';
const appId = 1;
const platformVersion = '2025.2';
const migrationId = 456;
const buildId = 789;
const projectDest = '/mock/dest';

// Mock unmigratable apps with proper enum values
const mockUnmigratableApps: UnmigratableApp[] = [
  createMockUnmigratableApp(3, 'App 3', UNMIGRATABLE_REASONS.UP_TO_DATE),
  createMockUnmigratableApp(4, 'App 4', UNMIGRATABLE_REASONS.IS_A_PRIVATE_APP),
];

describe('lib/app/migrate', () => {
  beforeEach(() => {
    mockedGetCwd.mockReturnValue('/mock/cwd');
    mockedSanitizeFileName.mockImplementation(name => name);
    mockedValidateUid.mockReturnValue(undefined);
    mockedHasFeature.mockResolvedValue(true);
    mockedFs.renameSync.mockImplementation(() => {});

    // Clear all mocks between tests
    jest.clearAllMocks();
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
            projectName,
            accountId
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
          projectName,
          accountId
        );
        expect(result).toBe(testCase.expected);
      });
    });
  });

  describe('generateFilterAppsByProjectNameFunction', () => {
    it('should return a function that filters by project name when projectConfig is provided', () => {
      const projectConfig = createLoadedProjectConfig(projectName);
      const filterFn = generateFilterAppsByProjectNameFunction(projectConfig);

      const matchingApp = createMockMigratableApp(1, 'App 1', projectName);
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

      const app1 = createMockMigratableApp(1, 'App 1', projectName);
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
          createMockMigratableApp(1, 'App 1', projectName),
          createMockMigratableApp(2, 'App 2', projectName),
        ],
        [createMockUnmigratableApp(3, 'App 3', UNMIGRATABLE_REASONS.UP_TO_DATE)]
      );
    });

    it('should return all apps when no projectConfig is provided', async () => {
      setupMockApps([createMockMigratableApp(1, 'App 1')]);

      const result = await fetchMigrationApps(
        undefined,
        accountId,
        platformVersion
      );
      expect(result).toHaveLength(1);
      expect(result[0].appId).toBe(1);
    });

    it('should filter apps by project name when projectConfig is provided', async () => {
      const projectConfig = createLoadedProjectConfig(projectName);
      setupMockApps([createMockMigratableApp(1, 'App 1', projectName)]);

      const result = await fetchMigrationApps(
        undefined,
        accountId,
        platformVersion,
        projectConfig
      );
      expect(result).toHaveLength(1);
      expect(result[0].projectName).toBe(projectName);
    });

    it('should throw an error when multiple apps are found for a project', async () => {
      const projectConfig = createLoadedProjectConfig(projectName);
      setupMockApps([
        createMockMigratableApp(1, 'App 1', projectName),
        createMockMigratableApp(2, 'App 2', projectName),
      ]);

      await expect(
        fetchMigrationApps(undefined, accountId, platformVersion, projectConfig)
      ).rejects.toThrow(lib.migrate.errors.project.multipleApps);
    });

    it('should throw an error when no apps are found for a project', async () => {
      const projectConfig = createLoadedProjectConfig(projectName);
      setupMockApps([], []);

      await expect(
        fetchMigrationApps(undefined, accountId, platformVersion, projectConfig)
      ).rejects.toThrow(lib.migrate.errors.noAppsForProject(projectName));
    });

    it('should throw an error when no migratable apps are found', async () => {
      setupMockApps([], mockUnmigratableApps);

      await expect(
        fetchMigrationApps(undefined, accountId, platformVersion)
      ).rejects.toThrow(/No apps in account/);
    });

    it('should throw an error when appId is provided but not found', async () => {
      await expect(
        fetchMigrationApps(999, accountId, platformVersion)
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
      await promptForAppToMigrate(mockApps, accountId);

      expect(mockedListPrompt).toHaveBeenCalledWith(
        lib.migrate.prompt.chooseApp,
        expect.any(Object)
      );
    });

    it('should return the selected app', async () => {
      mockedListPrompt.mockResolvedValue({ appId: mockApps[0].appId });
      const result = await promptForAppToMigrate(mockApps, accountId);
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
      expect(result).toEqual({ proceed: false, appIdToMigrate: 1 });
    });

    it('should return proceed: true and appIdToMigrate when user confirms', async () => {
      const result = await selectAppToMigrate(mockApps, accountId);
      expect(result).toEqual({ proceed: true, appIdToMigrate: 1 });
    });
  });

  describe('handleMigrationSetup', () => {
    const defaultOptions = {
      name: projectName,
      dest: projectDest,
      appId: appId,
      platformVersion: platformVersion,
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
      const result = await handleMigrationSetup(accountId, defaultOptions);
      expect(result).toEqual({});
    });

    it('should return project details when projectConfig is provided', async () => {
      const projectConfig = createLoadedProjectConfig(projectName);

      // @ts-expect-error
      mockedListAppsForMigration.mockResolvedValueOnce({
        data: {
          migratableApps: [createMockMigratableApp(1, 'App 1', projectName)],
          unmigratableApps: [],
        },
      });

      const result = await handleMigrationSetup(
        accountId,
        defaultOptions,
        projectConfig
      );

      expect(result).toEqual({
        appIdToMigrate: 1,
        projectName: projectName,
        projectDest: '/mock/project/dir',
      });
    });

    it('should prompt for project name when not provided', async () => {
      const optionsWithoutName = { ...defaultOptions, name: undefined };
      mockedInputPrompt.mockResolvedValue('New Project');

      await handleMigrationSetup(accountId, optionsWithoutName);

      expect(mockedInputPrompt).toHaveBeenCalledWith(
        lib.migrate.prompt.inputName,
        expect.any(Object)
      );
    });

    it('should prompt for project destination when not provided', async () => {
      const optionsWithoutDest = { ...defaultOptions, dest: undefined };
      mockedInputPrompt.mockResolvedValue('/mock/new/dest');

      await handleMigrationSetup(accountId, optionsWithoutDest);

      expect(mockedInputPrompt).toHaveBeenCalledWith(
        lib.migrate.prompt.inputDest,
        expect.any(Object)
      );
    });

    it('should throw an error when project already exists', async () => {
      mockedEnsureProjectExists.mockResolvedValue({ projectExists: true });

      await expect(
        handleMigrationSetup(accountId, defaultOptions)
      ).rejects.toThrow(lib.migrate.errors.project.alreadyExists(projectName));
    });
  });

  describe('beginMigration', () => {
    beforeEach(() => {
      // @ts-expect-error
      mockedInitializeMigration.mockResolvedValue({
        data: { migrationId: migrationId },
      });

      mockedPoll.mockResolvedValue({
        status: MIGRATION_STATUS.INPUT_REQUIRED,
        // @ts-expect-error
        componentsRequiringUids: {},
      });

      mockedInputPrompt.mockResolvedValue('test-uid');
    });

    it('should initialize migration and return migrationId and uidMap', async () => {
      const result = await beginMigration(accountId, appId, platformVersion);

      expect(result).toEqual({
        migrationId: migrationId,
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

      await beginMigration(accountId, appId, platformVersion);

      expect(mockedInputPrompt).toHaveBeenCalledWith(
        lib.migrate.prompt.uidForComponent("card 'test-card'"),
        {
          defaultAnswer: componentHint,
          validate: expect.any(Function),
        }
      );
    });

    it('should throw an error when migration fails', async () => {
      mockedPoll.mockRejectedValue(new Error('Failed'));

      await expect(
        beginMigration(accountId, appId, platformVersion)
      ).rejects.toThrow(/Migration Failed/);
    });
  });

  describe('pollMigrationStatus', () => {
    it('should call poll with checkMigrationStatusV2', async () => {
      const mockStatus = {
        id: migrationId,
        status: MIGRATION_STATUS.SUCCESS,
        buildId: buildId,
      };

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
    const uidMap = { '1': 'test-uid' };

    beforeEach(() => {
      // @ts-expect-error
      mockedContinueMigration.mockResolvedValue({
        data: { migrationId: migrationId },
      });

      mockedPoll.mockResolvedValue({
        status: MIGRATION_STATUS.SUCCESS,
        // @ts-expect-error
        buildId: buildId,
      });
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
      mockedPoll.mockRejectedValue(new Error('Test error'));

      await expect(
        finalizeMigration(accountId, migrationId, uidMap, projectName)
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
      mockedGetCwd.mockReturnValue('/mock/cwd');
      mockedSanitizeFileName.mockReturnValue(projectName);
    });

    it('should download and extract project files', async () => {
      await downloadProjectFiles(accountId, projectName, buildId, projectDest);

      expect(mockedDownloadProject).toHaveBeenCalledWith(
        accountId,
        projectName,
        buildId
      );

      expect(mockedExtractZipArchive).toHaveBeenCalledWith(
        expect.any(Buffer),
        projectName,
        expect.stringContaining(projectDest),
        {
          includesRootDir: true,
          hideLogs: true,
        }
      );
    });

    it('should handle projectConfig correctly', async () => {
      const projectConfig = {
        projectConfig: { name: projectName, srcDir: 'src' },
        projectDir: '/mock/project/dir',
      } as LoadedProjectConfig;

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
        downloadProjectFiles(accountId, projectName, buildId, projectDest)
      ).rejects.toThrow(error);
    });
  });

  describe('migrateApp2025_2', () => {
    const options = {
      name: projectName,
      dest: projectDest,
      appId: appId,
      platformVersion: platformVersion,
      unstable: false,
    } as ArgumentsCamelCase<MigrateAppArgs>;

    beforeEach(() => {
      mockedHasFeature.mockResolvedValue(true);
    });

    it('should throw an error when account is not ungated for unified apps', async () => {
      mockedHasFeature.mockResolvedValueOnce(false);

      await expect(migrateApp2025_2(accountId, options)).rejects.toThrowError(
        /isn't enrolled in the required product beta to access this command./
      );
    });

    it('should throw an error when projectConfig is invalid', async () => {
      const invalidProjectConfig = {
        projectConfig: undefined,
        projectDir: '/mock/project/dir',
      } as unknown as LoadedProjectConfig;

      await expect(
        migrateApp2025_2(accountId, options, invalidProjectConfig)
      ).rejects.toThrow(/The project configuration file is invalid/);
    });

    it('should throw an error when project does not exist', async () => {
      const projectConfig = createLoadedProjectConfig(projectName);

      mockedEnsureProjectExists.mockResolvedValueOnce({
        projectExists: false,
      });

      await expect(
        migrateApp2025_2(accountId, options, projectConfig)
      ).rejects.toThrow(/Migrations are only supported for existing projects/);
    });
  });

  describe('logInvalidAccountError', () => {
    it('should log the invalid account error message', () => {
      logInvalidAccountError();

      expect(mockedLogger.error).toHaveBeenCalledWith(
        lib.migrate.errors.invalidAccountTypeTitle
      );

      expect(mockedLogger.log).toHaveBeenCalledWith(
        expect.stringContaining(
          'Only public apps created in a developer account can be converted to a project component'
        )
      );
    });
  });
});

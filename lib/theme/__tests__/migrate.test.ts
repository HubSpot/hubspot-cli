import { ArgumentsCamelCase } from 'yargs';
import {
  getProjectThemeDetails,
  migrateThemes,
} from '@hubspot/project-parsing-lib';
import { MockedFunction } from 'vitest';
import { confirmPrompt } from '../../prompts/promptUtils.js';
import {
  LoadedProjectConfig,
  writeProjectConfig,
} from '../../projects/config.js';
import { ensureProjectExists } from '../../projects/ensureProjectExists.js';
import { isV2Project } from '../../projects/platformVersion.js';
import { fetchMigrationApps } from '../../app/migrate.js';
import {
  getHasMigratableThemes,
  validateMigrationAppsAndThemes,
  handleThemesMigration,
  migrateThemes2025_2,
  MigrateThemesArgs,
} from '../migrate.js';
import { lib } from '../../../lang/en.js';

vi.mock('@hubspot/local-dev-lib/logger');
vi.mock('@hubspot/project-parsing-lib');
vi.mock('../../prompts/promptUtils');
vi.mock('../../projects/config');
vi.mock('../../projects/ensureProjectExists');
vi.mock('../../projects/platformVersion');
vi.mock('../../app/migrate');

const mockedGetProjectThemeDetails = getProjectThemeDetails as MockedFunction<
  typeof getProjectThemeDetails
>;
const mockedMigrateThemes = migrateThemes as MockedFunction<
  typeof migrateThemes
>;
const mockedConfirmPrompt = confirmPrompt as MockedFunction<
  typeof confirmPrompt
>;
const mockedWriteProjectConfig = writeProjectConfig as MockedFunction<
  typeof writeProjectConfig
>;
const mockedEnsureProjectExists = ensureProjectExists as MockedFunction<
  typeof ensureProjectExists
>;
const mockedUseV3Api = isV2Project as MockedFunction<typeof isV2Project>;
const mockedFetchMigrationApps = fetchMigrationApps as MockedFunction<
  typeof fetchMigrationApps
>;

const ACCOUNT_ID = 123;
const PROJECT_NAME = 'Test Project';
const PLATFORM_VERSION = '2025.2';
const MOCK_PROJECT_DIR = '/mock/project/dir';

const createLoadedProjectConfig = (name: string): LoadedProjectConfig =>
  ({
    projectConfig: { name, srcDir: 'src', platformVersion: '2024.1' },
    projectDir: MOCK_PROJECT_DIR,
  }) as LoadedProjectConfig;

describe('lib/theme/migrate', () => {
  beforeEach(() => {
    mockedUseV3Api.mockReturnValue(false);
  });

  describe('getHasMigratableThemes', () => {
    it('should return false when no projectConfig is provided', async () => {
      const result = await getHasMigratableThemes();
      expect(result).toEqual({
        hasMigratableThemes: false,
        migratableThemesCount: 0,
      });
    });

    it('should return false when projectConfig is missing required properties', async () => {
      const invalidProjectConfig = {
        projectConfig: { name: undefined, srcDir: 'src' },
        projectDir: undefined,
      } as unknown as LoadedProjectConfig;

      const result = await getHasMigratableThemes(invalidProjectConfig);
      expect(result).toEqual({
        hasMigratableThemes: false,
        migratableThemesCount: 0,
      });
    });

    it('should return true when there are legacy themes', async () => {
      mockedGetProjectThemeDetails.mockResolvedValue({
        legacyThemeDetails: [
          {
            configFilepath: 'src/theme.json',
            themePath: 'src/theme',
            themeConfig: {
              secret_names: ['my-secret'],
            },
          },
        ],
        legacyReactThemeDetails: [],
      });
      const projectConfig = createLoadedProjectConfig(PROJECT_NAME);
      const result = await getHasMigratableThemes(projectConfig);
      expect(result).toEqual({
        hasMigratableThemes: true,
        migratableThemesCount: 1,
      });
    });

    it('should return true when there are legacy React themes', async () => {
      mockedGetProjectThemeDetails.mockResolvedValue({
        legacyThemeDetails: [],
        legacyReactThemeDetails: [
          {
            configFilepath: 'src/react-theme.json',
            themePath: 'src/react-theme',
            themeConfig: {
              secretNames: ['my-secret'],
            },
          },
        ],
      });
      const projectConfig = createLoadedProjectConfig(PROJECT_NAME);
      const result = await getHasMigratableThemes(projectConfig);
      expect(result).toEqual({
        hasMigratableThemes: true,
        migratableThemesCount: 1,
      });
    });

    it('should return true when there are both legacy and React themes', async () => {
      mockedGetProjectThemeDetails.mockResolvedValue({
        legacyThemeDetails: [
          {
            configFilepath: 'src/theme.json',
            themePath: 'src/theme',
            themeConfig: {
              secret_names: ['my-secret'],
            },
          },
        ],
        legacyReactThemeDetails: [
          {
            configFilepath: 'src/react-theme.json',
            themePath: 'src/react-theme',
            themeConfig: {
              secretNames: ['my-secret'],
            },
          },
        ],
      });
      const projectConfig = createLoadedProjectConfig(PROJECT_NAME);
      const result = await getHasMigratableThemes(projectConfig);
      expect(result).toEqual({
        hasMigratableThemes: true,
        migratableThemesCount: 2,
      });
    });
  });

  describe('validateMigrationAppsAndThemes', () => {
    it('should throw an error when themes are already migrated (v3 API)', async () => {
      mockedUseV3Api.mockReturnValue(true);
      const projectConfig = createLoadedProjectConfig(PROJECT_NAME);

      await expect(
        validateMigrationAppsAndThemes(0, projectConfig)
      ).rejects.toThrow(lib.migrate.errors.project.themesAlreadyMigrated);
    });

    it('should throw an error when apps and themes are both present', async () => {
      const projectConfig = createLoadedProjectConfig(PROJECT_NAME);

      await expect(
        validateMigrationAppsAndThemes(1, projectConfig)
      ).rejects.toThrow(lib.migrate.errors.project.themesAndAppsNotAllowed);
    });

    it('should throw an error when no project config is provided', async () => {
      await expect(validateMigrationAppsAndThemes(0)).rejects.toThrow(
        lib.migrate.errors.project.noProjectForThemesMigration
      );
    });

    it('should not throw an error when validation passes', async () => {
      const projectConfig = createLoadedProjectConfig(PROJECT_NAME);

      await expect(
        validateMigrationAppsAndThemes(0, projectConfig)
      ).resolves.not.toThrow();
    });
  });

  describe('handleThemesMigration', () => {
    const projectConfig = createLoadedProjectConfig(PROJECT_NAME);

    beforeEach(() => {
      mockedMigrateThemes.mockResolvedValue({
        migrated: true,
        failureReason: undefined,
        legacyThemeDetails: [],
        legacyReactThemeDetails: [],
      });
      mockedWriteProjectConfig.mockReturnValue(true);
    });

    it('should throw an error when project config is invalid', async () => {
      const invalidProjectConfig = {
        projectConfig: { name: PROJECT_NAME, srcDir: undefined },
        projectDir: undefined,
      } as unknown as LoadedProjectConfig;

      await expect(
        handleThemesMigration(invalidProjectConfig, PLATFORM_VERSION)
      ).rejects.toThrow(lib.migrate.errors.project.invalidConfig);
    });

    it('should successfully migrate themes and update project config', async () => {
      await handleThemesMigration(projectConfig, PLATFORM_VERSION);

      expect(mockedMigrateThemes).toHaveBeenCalledWith(
        MOCK_PROJECT_DIR,
        `${MOCK_PROJECT_DIR}/src`
      );

      expect(mockedWriteProjectConfig).toHaveBeenCalledWith(
        `${MOCK_PROJECT_DIR}/hsproject.json`,
        expect.objectContaining({
          platformVersion: PLATFORM_VERSION,
        })
      );
    });

    it('should throw an error when theme migration fails', async () => {
      mockedMigrateThemes.mockResolvedValue({
        migrated: false,
        failureReason: 'Migration failed',
        legacyThemeDetails: [],
        legacyReactThemeDetails: [],
      });

      await expect(
        handleThemesMigration(projectConfig, PLATFORM_VERSION)
      ).rejects.toThrow('Migration failed');
    });

    it('should throw an error when project config write fails', async () => {
      mockedWriteProjectConfig.mockReturnValue(false);

      await expect(
        handleThemesMigration(projectConfig, PLATFORM_VERSION)
      ).rejects.toThrow(lib.migrate.errors.project.failedToUpdateProjectConfig);
    });

    it('should throw an error when migrateThemes throws an exception', async () => {
      mockedMigrateThemes.mockRejectedValue(new Error('Unexpected error'));

      await expect(
        handleThemesMigration(projectConfig, PLATFORM_VERSION)
      ).rejects.toThrow(lib.migrate.errors.project.failedToMigrateThemes);
    });
  });

  describe('migrateThemes2025_2', () => {
    const options = {
      platformVersion: PLATFORM_VERSION,
    } as ArgumentsCamelCase<MigrateThemesArgs>;
    const projectConfig = createLoadedProjectConfig(PROJECT_NAME);
    const themeCount = 2;

    beforeEach(() => {
      mockedEnsureProjectExists.mockResolvedValue({ projectExists: true });
      mockedFetchMigrationApps.mockResolvedValue({
        migratableApps: [],
        unmigratableApps: [],
      });
      mockedConfirmPrompt.mockResolvedValue(true);
      mockedMigrateThemes.mockResolvedValue({
        migrated: true,
        failureReason: undefined,
        legacyThemeDetails: [],
        legacyReactThemeDetails: [],
      });
      mockedWriteProjectConfig.mockReturnValue(true);
    });

    it('should throw an error when project config is invalid', async () => {
      const invalidProjectConfig = {
        projectConfig: undefined,
        projectDir: MOCK_PROJECT_DIR,
      } as unknown as LoadedProjectConfig;

      await expect(
        migrateThemes2025_2(
          ACCOUNT_ID,
          options,
          themeCount,
          invalidProjectConfig
        )
      ).rejects.toThrow(lib.migrate.errors.project.invalidConfig);
    });

    it('should throw an error when project does not exist', async () => {
      mockedEnsureProjectExists.mockResolvedValue({ projectExists: false });

      await expect(
        migrateThemes2025_2(ACCOUNT_ID, options, themeCount, projectConfig)
      ).rejects.toThrow(lib.migrate.errors.project.doesNotExist(ACCOUNT_ID));
    });

    it('should proceed with migration when user confirms', async () => {
      await migrateThemes2025_2(ACCOUNT_ID, options, themeCount, projectConfig);

      expect(mockedFetchMigrationApps).toHaveBeenCalledWith(
        ACCOUNT_ID,
        PLATFORM_VERSION,
        projectConfig
      );

      expect(mockedConfirmPrompt).toHaveBeenCalledWith(
        lib.migrate.prompt.proceed,
        { defaultAnswer: false }
      );

      expect(mockedMigrateThemes).toHaveBeenCalledWith(
        MOCK_PROJECT_DIR,
        `${MOCK_PROJECT_DIR}/src`
      );
    });

    it('should exit without migrating when user cancels', async () => {
      mockedConfirmPrompt.mockResolvedValue(false);

      await migrateThemes2025_2(ACCOUNT_ID, options, themeCount, projectConfig);

      expect(mockedMigrateThemes).not.toHaveBeenCalled();
    });

    it('should validate migration apps and themes', async () => {
      await migrateThemes2025_2(ACCOUNT_ID, options, themeCount, projectConfig);

      // The validation is called internally, so we verify it through the error handling
      expect(mockedFetchMigrationApps).toHaveBeenCalled();
    });
  });
});

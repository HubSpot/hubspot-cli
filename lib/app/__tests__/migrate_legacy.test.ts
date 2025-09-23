import { fetchPublicAppMetadata as _fetchPublicAppMetadata } from '@hubspot/local-dev-lib/api/appsDev';
import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import {
  downloadProject as _downloadProject,
  migrateApp as _migrateNonProjectApp_v2023_2,
} from '@hubspot/local-dev-lib/api/projects';
import { extractZipArchive } from '@hubspot/local-dev-lib/archive';
import { ArgumentsCamelCase } from 'yargs';
import { promptUser as _promptUser } from '../../prompts/promptUtils.js';
import { EXIT_CODES } from '../../enums/exitCodes.js';
import {
  isAppDeveloperAccount as _isAppDeveloperAccount,
  isUnifiedAccount as _isUnifiedAccount,
} from '../../accountTypes.js';
import { selectPublicAppForMigrationPrompt as _selectPublicAppForMigrationPrompt } from '../../prompts/selectPublicAppForMigrationPrompt.js';
import { projectNameAndDestPrompt as _projectNameAndDestPrompt } from '../../prompts/projectNameAndDestPrompt.js';
import { ensureProjectExists as _ensureProjectExists } from '../../projects/ensureProjectExists.js';
import { poll as _poll } from '../../polling.js';
import { migrateApp2023_2 } from '../migrate_legacy.js';
import { MigrateAppArgs } from '../migrate.js';
import { MockedFunction } from 'vitest';

// Mock all external dependencies
vi.mock('@hubspot/local-dev-lib/api/appsDev');
vi.mock('@hubspot/local-dev-lib/logger');
vi.mock('@hubspot/local-dev-lib/api/projects');
vi.mock('@hubspot/local-dev-lib/path');
vi.mock('@hubspot/local-dev-lib/urls');
vi.mock('@hubspot/local-dev-lib/archive');
vi.mock('../../prompts/promptUtils');
vi.mock('../../errorHandlers');
vi.mock('../../accountTypes');
vi.mock('../../prompts/selectPublicAppForMigrationPrompt');
vi.mock('../../prompts/projectNameAndDestPrompt');
vi.mock('../../projects/ensureProjectExists');
vi.mock('../../usageTracking');
vi.mock('../../ui/SpinniesManager');
vi.mock('../../process');
vi.mock('../../polling');

const isAppDeveloperAccount = _isAppDeveloperAccount as MockedFunction<
  typeof _isAppDeveloperAccount
>;

const isUnifiedAccount = _isUnifiedAccount as MockedFunction<
  typeof _isUnifiedAccount
>;

const selectPublicAppForMigrationPrompt =
  _selectPublicAppForMigrationPrompt as MockedFunction<
    typeof _selectPublicAppForMigrationPrompt
  >;

const projectNameAndDestPrompt = _projectNameAndDestPrompt as MockedFunction<
  typeof _projectNameAndDestPrompt
>;

const ensureProjectExists = _ensureProjectExists as MockedFunction<
  typeof _ensureProjectExists
>;

const poll = _poll as MockedFunction<typeof _poll>;
const fetchPublicAppMetadata = _fetchPublicAppMetadata as MockedFunction<
  typeof _fetchPublicAppMetadata
>;

const migrateNonProjectApp_v2023_2 =
  _migrateNonProjectApp_v2023_2 as MockedFunction<
    typeof _migrateNonProjectApp_v2023_2
  >;

const downloadProject = _downloadProject as MockedFunction<
  typeof _downloadProject
>;
const promptUser = _promptUser as MockedFunction<typeof _promptUser>;

describe('migrateApp2023_2', () => {
  const mockDerivedAccountId = 123;
  const mockOptions: ArgumentsCamelCase<MigrateAppArgs> = {
    _: [],
    $0: 'test',
    derivedAccountId: 123,
    d: false,
    debug: false,
    platformVersion: '2023.2',
    unstable: false,
  };
  const mockAccountConfig: CLIAccount = {
    accountId: 123,
    name: 'Test Account',
    env: 'prod',
  };
  const appId = 12345;
  const projectName = 'test-project';

  beforeEach(() => {
    // @ts-expect-error function mismatch
    vi.spyOn(process, 'exit').mockImplementation(() => {});
    selectPublicAppForMigrationPrompt.mockResolvedValue({
      appId,
    });

    isAppDeveloperAccount.mockReturnValue(true);
    isUnifiedAccount.mockResolvedValue(false);

    fetchPublicAppMetadata.mockResolvedValue({
      // @ts-expect-error Mocking the return type
      data: { preventProjectMigrations: false },
    });

    projectNameAndDestPrompt.mockResolvedValue({
      name: projectName,
      dest: '/test/dest',
    });

    promptUser.mockResolvedValue({
      shouldCreateApp: true,
    });

    ensureProjectExists.mockResolvedValue({
      projectExists: false,
    });

    migrateNonProjectApp_v2023_2.mockResolvedValue({
      // @ts-expect-error Mocking the return type
      data: { id: 'migration-id' },
    });

    poll.mockResolvedValue({
      status: 'SUCCESS',
      // @ts-expect-error
      project: {
        name: projectName,
      },
    });

    downloadProject.mockResolvedValue({
      // @ts-expect-error Mocking the return type
      data: 'zipped-project-data',
    });
  });

  it('should exit if account is not an app developer account and not unified', async () => {
    isAppDeveloperAccount.mockReturnValue(false);

    await migrateApp2023_2(
      mockDerivedAccountId,
      mockOptions,
      mockAccountConfig
    );

    expect(migrateNonProjectApp_v2023_2).not.toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });

  it('should proceed with migration for valid app developer account', async () => {
    await migrateApp2023_2(
      mockDerivedAccountId,
      mockOptions,
      mockAccountConfig
    );

    expect(selectPublicAppForMigrationPrompt).toHaveBeenCalled();
    expect(fetchPublicAppMetadata).toHaveBeenCalledWith(
      appId,
      mockDerivedAccountId
    );
    expect(projectNameAndDestPrompt).toHaveBeenCalled();
    expect(ensureProjectExists).toHaveBeenCalled();
    expect(migrateNonProjectApp_v2023_2).toHaveBeenCalled();
    expect(poll).toHaveBeenCalled();
    expect(downloadProject).toHaveBeenCalled();
    expect(extractZipArchive).toHaveBeenCalled();
  });

  it('should handle migration failure gracefully', async () => {
    const errorMessage = 'Migration failed';
    migrateNonProjectApp_v2023_2.mockRejectedValue(new Error(errorMessage));

    await expect(
      migrateApp2023_2(mockDerivedAccountId, mockOptions, mockAccountConfig)
    ).rejects.toThrow(errorMessage);
  });

  it('should handle non-migratable apps', async () => {
    fetchPublicAppMetadata.mockResolvedValue({
      data: {
        preventProjectMigrations: true,
        // @ts-expect-error
        listingInfo: { someInfo: 'test' },
      },
    });

    await migrateApp2023_2(
      mockDerivedAccountId,
      mockOptions,
      mockAccountConfig
    );
    expect(process.exit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
  });

  it('should handle existing project error', async () => {
    ensureProjectExists.mockResolvedValue({
      projectExists: true,
    });

    await expect(
      migrateApp2023_2(mockDerivedAccountId, mockOptions, mockAccountConfig)
    ).rejects.toThrow('A project with name test-project already exists');
  });
});

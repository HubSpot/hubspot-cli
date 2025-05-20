import { fetchPublicAppMetadata as _fetchPublicAppMetadata } from '@hubspot/local-dev-lib/api/appsDev';
import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import {
  downloadProject as _downloadProject,
  migrateApp as _migrateNonProjectApp_v2023_2,
} from '@hubspot/local-dev-lib/api/projects';
import { extractZipArchive } from '@hubspot/local-dev-lib/archive';
import { ArgumentsCamelCase } from 'yargs';
import { promptUser as _promptUser } from '../../prompts/promptUtils';
import { EXIT_CODES } from '../../enums/exitCodes';
import {
  isAppDeveloperAccount as _isAppDeveloperAccount,
  isUnifiedAccount as _isUnifiedAccount,
} from '../../accountTypes';
import { selectPublicAppPrompt as _selectPublicAppPrompt } from '../../prompts/selectPublicAppPrompt';
import { createProjectPrompt as _createProjectPrompt } from '../../prompts/createProjectPrompt';
import { ensureProjectExists as _ensureProjectExists } from '../../projects/ensureProjectExists';
import { poll as _poll } from '../../polling';
import { migrateApp2023_2 } from '../migrate_legacy';
import { MigrateAppArgs } from '../migrate';

// Mock all external dependencies
jest.mock('@hubspot/local-dev-lib/api/appsDev');
jest.mock('@hubspot/local-dev-lib/logger');
jest.mock('@hubspot/local-dev-lib/api/projects');
jest.mock('@hubspot/local-dev-lib/path');
jest.mock('@hubspot/local-dev-lib/urls');
jest.mock('@hubspot/local-dev-lib/archive');
jest.mock('../../prompts/promptUtils');
jest.mock('../../errorHandlers');
jest.mock('../../accountTypes');
jest.mock('../../prompts/selectPublicAppPrompt');
jest.mock('../../prompts/createProjectPrompt');
jest.mock('../../projects/ensureProjectExists');
jest.mock('../../usageTracking');
jest.mock('../../ui/SpinniesManager');
jest.mock('../../process');
jest.mock('../../polling');

const isAppDeveloperAccount = _isAppDeveloperAccount as jest.MockedFunction<
  typeof _isAppDeveloperAccount
>;

const isUnifiedAccount = _isUnifiedAccount as jest.MockedFunction<
  typeof _isUnifiedAccount
>;

const selectPublicAppPrompt = _selectPublicAppPrompt as jest.MockedFunction<
  typeof _selectPublicAppPrompt
>;

const createProjectPrompt = _createProjectPrompt as jest.MockedFunction<
  typeof _createProjectPrompt
>;

const ensureProjectExists = _ensureProjectExists as jest.MockedFunction<
  typeof _ensureProjectExists
>;

const poll = _poll as jest.MockedFunction<typeof _poll>;
const fetchPublicAppMetadata = _fetchPublicAppMetadata as jest.MockedFunction<
  typeof _fetchPublicAppMetadata
>;

const migrateNonProjectApp_v2023_2 =
  _migrateNonProjectApp_v2023_2 as jest.MockedFunction<
    typeof _migrateNonProjectApp_v2023_2
  >;

const downloadProject = _downloadProject as jest.MockedFunction<
  typeof _downloadProject
>;
const promptUser = _promptUser as jest.MockedFunction<typeof _promptUser>;

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
    jest.spyOn(process, 'exit').mockImplementation(() => {});
    selectPublicAppPrompt.mockResolvedValue({
      appId,
    });

    isAppDeveloperAccount.mockReturnValue(true);
    isUnifiedAccount.mockResolvedValue(false);

    fetchPublicAppMetadata.mockResolvedValue({
      // @ts-expect-error Mocking the return type
      data: { preventProjectMigrations: false },
    });

    createProjectPrompt.mockResolvedValue({
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

    expect(selectPublicAppPrompt).toHaveBeenCalled();
    expect(fetchPublicAppMetadata).toHaveBeenCalledWith(
      appId,
      mockDerivedAccountId
    );
    expect(createProjectPrompt).toHaveBeenCalled();
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

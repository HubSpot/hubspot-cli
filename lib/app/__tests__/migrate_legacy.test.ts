import { fetchPublicAppMetadata } from '@hubspot/local-dev-lib/api/appsDev';
import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  checkMigrationStatus,
  downloadProject,
  migrateApp as migrateNonProjectApp_v2023_2,
} from '@hubspot/local-dev-lib/api/projects';
import path from 'path';
import { getCwd, sanitizeFileName } from '@hubspot/local-dev-lib/path';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { extractZipArchive } from '@hubspot/local-dev-lib/archive';
import { ArgumentsCamelCase } from 'yargs';
import { promptUser } from '../../prompts/promptUtils';
import { ApiErrorContext, logError } from '../../errorHandlers';
import { EXIT_CODES } from '../../enums/exitCodes';
import { uiAccountDescription, uiLine, uiLink } from '../../ui';
import { i18n } from '../../lang';
import { isAppDeveloperAccount, isUnifiedAccount } from '../../accountTypes';
import { selectPublicAppPrompt } from '../../prompts/selectPublicAppPrompt';
import { createProjectPrompt } from '../../prompts/createProjectPrompt';
import { ensureProjectExists } from '../../projects/ensureProjectExists';
import { trackCommandMetadataUsage } from '../../usageTracking';
import SpinniesManager from '../../ui/SpinniesManager';
import { handleKeypress } from '../../process';
import { poll } from '../../polling';
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

  beforeEach(() => {
    // @ts-expect-error function mismatch
    jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  it('should exit if account is not an app developer account and not unified', async () => {
    (isAppDeveloperAccount as jest.Mock).mockReturnValue(false);
    (isUnifiedAccount as jest.Mock).mockResolvedValue(false);

    await migrateApp2023_2(
      mockDerivedAccountId,
      mockOptions,
      mockAccountConfig
    );
    expect(process.exit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });

  it('should proceed with migration for valid app developer account', async () => {
    (isAppDeveloperAccount as jest.Mock).mockReturnValue(true);
    (isUnifiedAccount as jest.Mock).mockResolvedValue(false);
    (selectPublicAppPrompt as jest.Mock).mockResolvedValue({
      appId: 'test-app-id',
    });
    (fetchPublicAppMetadata as jest.Mock).mockResolvedValue({
      data: { preventProjectMigrations: false },
    });
    (createProjectPrompt as jest.Mock).mockResolvedValue({
      name: 'test-project',
      dest: '/test/dest',
    });
    (ensureProjectExists as jest.Mock).mockResolvedValue({
      projectExists: false,
    });
    (migrateNonProjectApp_v2023_2 as jest.Mock).mockResolvedValue({
      data: { id: 'migration-id' },
    });
    (poll as jest.Mock).mockResolvedValue({
      status: 'SUCCESS',
      project: { name: 'test-project' },
    });
    (downloadProject as jest.Mock).mockResolvedValue({
      data: 'zipped-project-data',
    });
    // Mock promptUser correctly
    (promptUser as jest.Mock).mockResolvedValue({
      shouldCreateApp: true,
    });

    await migrateApp2023_2(
      mockDerivedAccountId,
      mockOptions,
      mockAccountConfig
    );

    expect(selectPublicAppPrompt).toHaveBeenCalled();
    expect(fetchPublicAppMetadata).toHaveBeenCalledWith(
      'test-app-id',
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
    (isAppDeveloperAccount as jest.Mock).mockReturnValue(true);
    (isUnifiedAccount as jest.Mock).mockResolvedValue(false);
    (selectPublicAppPrompt as jest.Mock).mockResolvedValue({
      appId: 'test-app-id',
    });
    (fetchPublicAppMetadata as jest.Mock).mockResolvedValue({
      data: { preventProjectMigrations: false },
    });
    (createProjectPrompt as jest.Mock).mockResolvedValue({
      name: 'test-project',
      dest: '/test/dest',
    });
    (ensureProjectExists as jest.Mock).mockResolvedValue({
      projectExists: false,
    });
    (promptUser as jest.Mock).mockResolvedValue({
      shouldCreateApp: true,
    });
    (migrateNonProjectApp_v2023_2 as jest.Mock).mockRejectedValue(
      new Error('Migration failed')
    );

    await expect(
      migrateApp2023_2(mockDerivedAccountId, mockOptions, mockAccountConfig)
    ).rejects.toThrow('Migration failed');
  });

  it('should handle non-migratable apps', async () => {
    (isAppDeveloperAccount as jest.Mock).mockReturnValue(true);
    (isUnifiedAccount as jest.Mock).mockResolvedValue(false);
    (selectPublicAppPrompt as jest.Mock).mockResolvedValue({
      appId: 'test-app-id',
    });
    (fetchPublicAppMetadata as jest.Mock).mockResolvedValue({
      data: {
        preventProjectMigrations: true,
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
    (isAppDeveloperAccount as jest.Mock).mockReturnValue(true);
    (isUnifiedAccount as jest.Mock).mockResolvedValue(false);
    (selectPublicAppPrompt as jest.Mock).mockResolvedValue({
      appId: 'test-app-id',
    });
    (fetchPublicAppMetadata as jest.Mock).mockResolvedValue({
      data: { preventProjectMigrations: false },
    });
    (createProjectPrompt as jest.Mock).mockResolvedValue({
      name: 'test-project',
      dest: '/test/dest',
    });
    (ensureProjectExists as jest.Mock).mockResolvedValue({
      projectExists: true,
    });
    (promptUser as jest.Mock).mockResolvedValue({
      shouldCreateApp: true,
    });

    await expect(
      migrateApp2023_2(mockDerivedAccountId, mockOptions, mockAccountConfig)
    ).rejects.toThrow('A project with name test-project already exists');
  });
});

import { migrateApp2025_2, migrateApp2023_2 } from '../migrate';
import { logger } from '@hubspot/local-dev-lib/logger';
import { promptUser, listPrompt, inputPrompt } from '../../prompts/promptUtils';
import {
  listAppsForMigration,
  beginMigration,
  finishMigration,
  downloadProject,
  migrateNonProjectApp_v2023_2,
  UNMIGRATABLE_REASONS,
} from '@hubspot/local-dev-lib/api/projects';
import { extractZipArchive } from '@hubspot/local-dev-lib/archive';
import { getCwd, sanitizeFileName } from '@hubspot/local-dev-lib/path';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { fetchPublicAppMetadata } from '@hubspot/local-dev-lib/api/appsDev';
import { poll } from '../../polling';
import SpinniesManager from '../../ui/SpinniesManager';
import { selectPublicAppPrompt } from '../../prompts/selectPublicAppPrompt';
import { createProjectPrompt } from '../../prompts/createProjectPrompt';
import { EXIT_CODES } from '../../enums/exitCodes';
import { MigrateAppOptions } from '../../../types/Yargs';
import { ArgumentsCamelCase } from 'yargs';
import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { ensureProjectExists } from '../../projects';
import { i18n } from '../../lang';
import { isAppDeveloperAccount } from '../../accountTypes';
import { handleKeypress } from '../../process';
import { trackCommandMetadataUsage } from '../../usageTracking';
import { logError } from '../../errorHandlers';
import {
  uiAccountDescription,
  uiBetaTag,
  uiCommandReference,
  uiLine,
  uiLink,
} from '../../ui';
import chalk from 'chalk';

jest.mock('@hubspot/local-dev-lib/logger');
jest.mock('../../prompts/promptUtils');
jest.mock('../../projects');
jest.mock('@hubspot/local-dev-lib/api/projects');
jest.mock('@hubspot/local-dev-lib/archive');
jest.mock('@hubspot/local-dev-lib/path');
jest.mock('@hubspot/local-dev-lib/urls');
jest.mock('@hubspot/local-dev-lib/api/appsDev');
jest.mock('../../usageTracking');
jest.mock('../../polling');
jest.mock('../../ui/SpinniesManager');
jest.mock('../../prompts/selectPublicAppPrompt');
jest.mock('../../prompts/createProjectPrompt');
jest.mock('../../lang');
jest.mock('../../accountTypes');
jest.mock('../../process');
jest.mock('../../errorHandlers');
jest.mock('../../ui');
jest.mock('chalk', () => ({
  bold: jest.fn().mockReturnValue('Bold Text'),
}));

describe('lib/app/migrate', () => {
  const mockDerivedAccountId = 12345;
  const mockOptions: ArgumentsCamelCase<MigrateAppOptions> = {
    name: 'test-project',
    dest: 'test-dest',
    appId: 67890,
    platformVersion: '2025.2',
    derivedAccountId: mockDerivedAccountId,
    d: false,
    debug: false,
    _: [],
    $0: 'test',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const mockExit = jest.fn();
    (process.exit as unknown as jest.Mock) = mockExit;
    (ensureProjectExists as jest.Mock).mockResolvedValue({ projectExists: false });
    (logger.error as jest.Mock).mockImplementation(() => {});
    (logger.log as jest.Mock).mockImplementation(() => {});
    (logger.success as jest.Mock).mockImplementation(() => {});
    (logger.warn as jest.Mock).mockImplementation(() => {});
    (i18n as jest.Mock).mockImplementation((key) => key);
    (listPrompt as jest.Mock).mockResolvedValue({ appId: 67890 });
    (inputPrompt as jest.Mock).mockImplementation((prompt) => {
      if (prompt.includes('inputName')) return mockOptions.name;
      if (prompt.includes('inputDest')) return mockOptions.dest;
      return '';
    });
    (promptUser as jest.Mock).mockResolvedValue({ shouldCreateApp: true });
    (isAppDeveloperAccount as jest.Mock).mockReturnValue(true);
    (handleKeypress as jest.Mock).mockImplementation(() => {});
    (trackCommandMetadataUsage as jest.Mock).mockResolvedValue(undefined);
    (logError as jest.Mock).mockImplementation(() => {});
    (uiAccountDescription as jest.Mock).mockReturnValue('Test Account');
    (uiBetaTag as jest.Mock).mockReturnValue('BETA');
    (uiCommandReference as jest.Mock).mockReturnValue('hs command');
    (uiLine as jest.Mock).mockReturnValue('---');
    (uiLink as jest.Mock).mockReturnValue('Link');
  });

  describe('migrateApp2025_2', () => {
    const mockMigrationData = {
      migratableApps: [
        { appId: 67890, appName: 'Test App', isMigratable: true },
      ],
      unmigratableApps: [],
    };

    const mockMigrationResponse = {
      migrationId: 123,
      uidsRequired: [],
    };

    const mockFinishResponse = {
      buildId: 456,
    };

    beforeEach(() => {
      (listAppsForMigration as jest.Mock).mockResolvedValue({
        data: mockMigrationData,
      });
      (beginMigration as jest.Mock).mockResolvedValue(mockMigrationResponse);
      (finishMigration as jest.Mock).mockResolvedValue(mockFinishResponse);
      (downloadProject as jest.Mock).mockResolvedValue({
        data: 'mock-zip-data',
      });
      (getCwd as jest.Mock).mockReturnValue('/mock/cwd');
      (promptUser as jest.Mock).mockResolvedValue({ shouldProceed: true });
    });

    it('should successfully migrate an app', async () => {
      await migrateApp2025_2(mockDerivedAccountId, mockOptions);

      expect(listAppsForMigration).toHaveBeenCalledWith(mockDerivedAccountId);
      expect(beginMigration).toHaveBeenCalledWith(mockOptions.appId);
      expect(finishMigration).toHaveBeenCalledWith(
        mockDerivedAccountId,
        mockMigrationResponse.migrationId,
        {},
        mockOptions.name
      );
      expect(downloadProject).toHaveBeenCalledWith(
        mockDerivedAccountId,
        mockOptions.name,
        mockFinishResponse.buildId
      );
      expect(extractZipArchive).toHaveBeenCalledWith(
        'mock-zip-data',
        sanitizeFileName(mockOptions.name),
        expect.any(String),
        { includesRootDir: false }
      );
      expect(process.exit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should handle no apps available for migration', async () => {
      (listAppsForMigration as jest.Mock).mockResolvedValue({
        data: { migratableApps: [], unmigratableApps: [] },
      });

      await expect(migrateApp2025_2(mockDerivedAccountId, mockOptions)).rejects.toThrow(
        'commands.project.subcommands.migrateApp.errors.noApps'
      );
    });

    it('should handle unmigratable apps', async () => {
      (listAppsForMigration as jest.Mock).mockResolvedValue({
        data: {
          migratableApps: [],
          unmigratableApps: [
            {
              appId: 67890,
              appName: 'Test App',
              isMigratable: false,
              unmigratableReason: UNMIGRATABLE_REASONS.UP_TO_DATE,
            },
          ],
        },
      });
      (promptUser as jest.Mock).mockResolvedValue({ shouldProceed: false });

      await migrateApp2025_2(mockDerivedAccountId, mockOptions);
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('commands.project.subcommands.migrateApp.errors.noAppsEligible'));
      expect(process.exit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should handle migration failure', async () => {
      (beginMigration as jest.Mock).mockRejectedValue(new Error('Migration failed'));
      (promptUser as jest.Mock).mockResolvedValue({ shouldProceed: true });

      await migrateApp2025_2(mockDerivedAccountId, mockOptions);
      expect(SpinniesManager.fail).toHaveBeenCalledWith('beginningMigration', {
        text: 'commands.project.subcommands.migrateApp.spinners.unableToStartMigration',
      });
      expect(process.exit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should handle project already exists error', async () => {
      (ensureProjectExists as jest.Mock).mockResolvedValue({ projectExists: true });

      await expect(migrateApp2025_2(mockDerivedAccountId, mockOptions)).rejects.toThrow(
        'commands.project.subcommands.migrateApp.errors.projectAlreadyExists'
      );
    });

    it('should handle download failure', async () => {
      (downloadProject as jest.Mock).mockRejectedValue(new Error('Download failed'));

      await migrateApp2025_2(mockDerivedAccountId, mockOptions);
      expect(SpinniesManager.fail).toHaveBeenCalledWith('fetchingMigratedProject', {
        text: 'commands.project.subcommands.migrateApp.spinners.downloadingProjectContentsFailed',
      });
      expect(process.exit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });

  describe('migrateApp2023_2', () => {
    const mockAccountConfig: CLIAccount = {
      env: 'qa',
      accountId: mockDerivedAccountId,
      name: 'Test Account',
      authType: 'personalaccesskey',
    };

    const mockAppMetadata = {
      preventProjectMigrations: false,
      listingInfo: null,
    };

    const mockMigrationResponse = {
      id: 123,
    };

    const mockPollResponse = {
      status: 'SUCCESS',
      project: {
        name: 'test-project',
      },
    };

    beforeEach(() => {
      (selectPublicAppPrompt as jest.Mock).mockResolvedValue({ appId: 67890 });
      (fetchPublicAppMetadata as jest.Mock).mockResolvedValue({
        data: mockAppMetadata,
      });
      (createProjectPrompt as jest.Mock).mockResolvedValue({
        name: 'test-project',
        dest: 'test-dest',
      });
      (migrateNonProjectApp_v2023_2 as jest.Mock).mockResolvedValue({
        data: mockMigrationResponse,
      });
      (poll as jest.Mock).mockResolvedValue(mockPollResponse);
      (downloadProject as jest.Mock).mockResolvedValue({
        data: 'mock-zip-data',
      });
      (getHubSpotWebsiteOrigin as jest.Mock).mockReturnValue('https://test.hubspot.com');
      (getCwd as jest.Mock).mockReturnValue('/mock/cwd');
    });

    it('should successfully migrate an app', async () => {
      (promptUser as jest.Mock).mockResolvedValue({ shouldCreateApp: true });

      await migrateApp2023_2(mockDerivedAccountId, mockOptions, mockAccountConfig);

      expect(fetchPublicAppMetadata).toHaveBeenCalledWith(
        67890,
        mockDerivedAccountId
      );
      expect(migrateNonProjectApp_v2023_2).toHaveBeenCalledWith(
        mockDerivedAccountId,
        67890,
        'test-project'
      );
      expect(poll).toHaveBeenCalled();
      expect(downloadProject).toHaveBeenCalled();
      expect(extractZipArchive).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should handle migration cancellation', async () => {
      (promptUser as jest.Mock).mockResolvedValue({ shouldCreateApp: false });

      await migrateApp2023_2(mockDerivedAccountId, mockOptions, mockAccountConfig);
      expect(process.exit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should handle invalid app metadata', async () => {
      (fetchPublicAppMetadata as jest.Mock).mockResolvedValue({
        data: {
          preventProjectMigrations: true,
          listingInfo: { someData: true },
        },
      });

      await migrateApp2023_2(mockDerivedAccountId, mockOptions, mockAccountConfig);
      expect(logger.error).toHaveBeenCalledWith('commands.project.subcommands.migrateApp.errors.invalidApp');
      expect(process.exit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should handle migration failure', async () => {
      (promptUser as jest.Mock).mockResolvedValue({ shouldCreateApp: true });
      (migrateNonProjectApp_v2023_2 as jest.Mock).mockRejectedValue(
        new Error('Migration failed')
      );

      await migrateApp2023_2(mockDerivedAccountId, mockOptions, mockAccountConfig);
      expect(SpinniesManager.fail).toHaveBeenCalledWith('migrateApp', {
        text: 'commands.project.subcommands.migrateApp.migrationStatus.failure',
        failColor: 'white',
      });
      expect(process.exit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should handle non-developer account', async () => {
      (isAppDeveloperAccount as jest.Mock).mockReturnValue(false);

      await migrateApp2023_2(mockDerivedAccountId, mockOptions, mockAccountConfig);
      expect(logger.error).toHaveBeenCalledWith('commands.project.subcommands.migrateApp.errors.invalidAccountTypeTitle');
      expect(process.exit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should handle project already exists error', async () => {
      (ensureProjectExists as jest.Mock).mockResolvedValue({ projectExists: true });

      await expect(migrateApp2023_2(mockDerivedAccountId, mockOptions, mockAccountConfig)).rejects.toThrow(
        'commands.project.subcommands.migrateApp.errors.projectAlreadyExists'
      );
    });

    it('should handle migration interruption', async () => {
      (handleKeypress as jest.Mock).mockImplementation((callback) => {
        callback({ ctrl: true, name: 'c' });
      });

      await migrateApp2023_2(mockDerivedAccountId, mockOptions, mockAccountConfig);
      expect(SpinniesManager.remove).toHaveBeenCalledWith('migrateApp');
      expect(logger.log).toHaveBeenCalledWith('commands.project.subcommands.migrateApp.migrationInterrupted');
      expect(process.exit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should handle metadata fetch failure', async () => {
      (fetchPublicAppMetadata as jest.Mock).mockRejectedValue(new Error('Metadata fetch failed'));

      await migrateApp2023_2(mockDerivedAccountId, mockOptions, mockAccountConfig);
      expect(process.exit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should handle download failure', async () => {
      (downloadProject as jest.Mock).mockRejectedValue(new Error('Download failed'));

      await migrateApp2023_2(mockDerivedAccountId, mockOptions, mockAccountConfig);
      expect(SpinniesManager.fail).toHaveBeenCalledWith('migrateApp', {
        text: 'commands.project.subcommands.migrateApp.migrationStatus.failure',
        failColor: 'white',
      });
      expect(process.exit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });
});

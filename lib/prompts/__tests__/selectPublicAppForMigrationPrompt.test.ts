import { fetchPublicAppsForPortal } from '@hubspot/local-dev-lib/api/appsDev';
import { PublicApp } from '@hubspot/local-dev-lib/types/Apps';
import { selectPublicAppForMigrationPrompt } from '../selectPublicAppForMigrationPrompt.js';
import { promptUser } from '../promptUtils.js';
import { logError } from '../../errorHandlers/index.js';
import { uiLine } from '../../ui/index.js';
import { uiLogger } from '../../ui/logger.js';
import { PromptExitError } from '../../errors/PromptExitError.js';
import { EXIT_CODES } from '../../enums/exitCodes.js';
import { lib } from '../../../lang/en.js';

vi.mock('@hubspot/local-dev-lib/api/appsDev');
vi.mock('../promptUtils');
vi.mock('../../errorHandlers/index');
vi.mock('../../ui/index');

const mockedFetchPublicAppsForPortal = vi.mocked(fetchPublicAppsForPortal);
const mockedPromptUser = vi.mocked(promptUser);
const mockedLogError = vi.mocked(logError);
const mockedUiLine = vi.mocked(uiLine);

const ACCOUNT_ID = 123;
const ACCOUNT_NAME = 'Dev Account';

const mockMigratableApp = { id: 1, name: 'Migratable' } as unknown as PublicApp;
const mockListedApp = {
  id: 2,
  name: 'Listed',
  preventProjectMigrations: true,
  listingInfo: { listed: true },
} as unknown as PublicApp;
const mockProjectApp = {
  id: 3,
  name: 'In Project',
  projectId: 99,
} as unknown as PublicApp;
const mockSourceApp = {
  id: 4,
  name: 'Has Source',
  sourceId: 'source',
} as unknown as PublicApp;

type PromptConfigs = Exclude<
  Parameters<typeof promptUser>[0],
  { name: unknown }
>;

function mockFetchedApps(apps: PublicApp[]): void {
  mockedFetchPublicAppsForPortal.mockResolvedValue({
    data: { results: apps },
  } as unknown as Awaited<ReturnType<typeof fetchPublicAppsForPortal>>);
}

function getPromptConfig(): PromptConfigs[number] {
  return (mockedPromptUser.mock.calls[0][0] as PromptConfigs)[0];
}

describe('lib/prompts/selectPublicAppForMigrationPrompt', () => {
  describe('selectPublicAppForMigrationPrompt()', () => {
    beforeEach(() => {
      mockFetchedApps([mockMigratableApp]);
      mockedPromptUser.mockResolvedValue({ appId: 1 });
    });

    it('should return the selected app id', async () => {
      const result = await selectPublicAppForMigrationPrompt({
        accountId: ACCOUNT_ID,
        accountName: ACCOUNT_NAME,
      });

      expect(result).toEqual({ appId: 1 });
    });

    it('should fetch the public apps for the account', async () => {
      await selectPublicAppForMigrationPrompt({
        accountId: ACCOUNT_ID,
        accountName: ACCOUNT_NAME,
      });

      expect(mockedFetchPublicAppsForPortal).toHaveBeenCalledWith(ACCOUNT_ID);
    });

    it('should use the clone message by default', async () => {
      await selectPublicAppForMigrationPrompt({
        accountId: ACCOUNT_ID,
        accountName: ACCOUNT_NAME,
      });

      expect(getPromptConfig()).toEqual(
        expect.objectContaining({
          name: 'appId',
          type: 'list',
          message:
            lib.prompts.selectPublicAppForMigrationPrompt.selectAppIdClone(
              ACCOUNT_NAME
            ),
        })
      );
    });

    it('should use the migrate message when migrating an app', async () => {
      await selectPublicAppForMigrationPrompt({
        accountId: ACCOUNT_ID,
        accountName: ACCOUNT_NAME,
        isMigratingApp: true,
      });

      expect(getPromptConfig()).toEqual(
        expect.objectContaining({
          message:
            lib.prompts.selectPublicAppForMigrationPrompt.selectAppIdMigrate(
              ACCOUNT_NAME
            ),
        })
      );
    });

    it('should exclude apps that are already part of a project or have a source', async () => {
      mockFetchedApps([mockMigratableApp, mockProjectApp, mockSourceApp]);

      await selectPublicAppForMigrationPrompt({
        accountId: ACCOUNT_ID,
        accountName: ACCOUNT_NAME,
      });

      expect(getPromptConfig().choices).toEqual([
        { name: 'Migratable (1)', value: 1 },
      ]);
    });

    it('should not disable listed apps that cannot be migrated when cloning', async () => {
      mockFetchedApps([mockMigratableApp, mockListedApp]);

      await selectPublicAppForMigrationPrompt({
        accountId: ACCOUNT_ID,
        accountName: ACCOUNT_NAME,
      });

      expect(getPromptConfig().choices).toEqual([
        { name: 'Migratable (1)', value: 1 },
        { name: 'Listed (2)', value: 2 },
      ]);
    });

    it('should disable listed apps that cannot be migrated when migrating', async () => {
      mockFetchedApps([mockMigratableApp, mockListedApp]);

      await selectPublicAppForMigrationPrompt({
        accountId: ACCOUNT_ID,
        accountName: ACCOUNT_NAME,
        isMigratingApp: true,
      });

      expect(getPromptConfig().choices).toEqual([
        { name: 'Migratable (1)', value: 1 },
        {
          name: 'Listed (2)',
          disabled:
            lib.prompts.selectPublicAppForMigrationPrompt.errors
              .cannotBeMigrated,
        },
      ]);
    });

    describe('when there is no account id', () => {
      it('should log an error and throw a PromptExitError with an error code', async () => {
        const promise = selectPublicAppForMigrationPrompt({
          accountId: null,
          accountName: ACCOUNT_NAME,
        });

        await expect(promise).rejects.toThrow(PromptExitError);
        await expect(promise).rejects.toMatchObject({
          message:
            lib.prompts.selectPublicAppForMigrationPrompt.errors.noAccountId,
          exitCode: EXIT_CODES.ERROR,
        });
        expect(uiLogger.error).toHaveBeenCalledWith(
          lib.prompts.selectPublicAppForMigrationPrompt.errors.noAccountId
        );
        expect(mockedFetchPublicAppsForPortal).not.toHaveBeenCalled();
      });
    });

    describe('when there are no apps to clone', () => {
      beforeEach(() => {
        mockFetchedApps([mockProjectApp]);
      });

      it('should throw a PromptExitError with a success code', async () => {
        const promise = selectPublicAppForMigrationPrompt({
          accountId: ACCOUNT_ID,
          accountName: ACCOUNT_NAME,
        });

        await expect(promise).rejects.toThrow(PromptExitError);
        await expect(promise).rejects.toMatchObject({
          message:
            lib.prompts.selectPublicAppForMigrationPrompt.errors.noAppsClone,
          exitCode: EXIT_CODES.SUCCESS,
        });
      });

      it('should log the no apps to clone message', async () => {
        await expect(
          selectPublicAppForMigrationPrompt({
            accountId: ACCOUNT_ID,
            accountName: ACCOUNT_NAME,
          })
        ).rejects.toThrow(PromptExitError);

        expect(uiLogger.error).toHaveBeenCalledWith(
          `${lib.prompts.selectPublicAppForMigrationPrompt.errors.noAppsClone}
${lib.prompts.selectPublicAppForMigrationPrompt.errors.noAppsCloneMessage(ACCOUNT_NAME)}`
        );
        expect(mockedUiLine).toHaveBeenCalledTimes(2);
        expect(mockedPromptUser).not.toHaveBeenCalled();
      });
    });

    describe('when there are no apps to migrate', () => {
      it('should throw a PromptExitError with a success code when there are no apps', async () => {
        mockFetchedApps([]);

        const promise = selectPublicAppForMigrationPrompt({
          accountId: ACCOUNT_ID,
          accountName: ACCOUNT_NAME,
          isMigratingApp: true,
        });

        await expect(promise).rejects.toThrow(PromptExitError);
        await expect(promise).rejects.toMatchObject({
          message:
            lib.prompts.selectPublicAppForMigrationPrompt.errors
              .noAppsMigration,
          exitCode: EXIT_CODES.SUCCESS,
        });
      });

      it('should log the no apps to migrate message when every app is listed and blocked from migration', async () => {
        mockFetchedApps([mockListedApp]);

        await expect(
          selectPublicAppForMigrationPrompt({
            accountId: ACCOUNT_ID,
            accountName: ACCOUNT_NAME,
            isMigratingApp: true,
          })
        ).rejects.toThrow(PromptExitError);

        expect(uiLogger.error).toHaveBeenCalledWith(
          `${lib.prompts.selectPublicAppForMigrationPrompt.errors.noAppsMigration}
${lib.prompts.selectPublicAppForMigrationPrompt.errors.noAppsMigrationMessage(ACCOUNT_NAME)}`
        );
        expect(mockedPromptUser).not.toHaveBeenCalled();
      });
    });

    describe('when fetching apps fails', () => {
      const error = new Error('fetch failed');

      beforeEach(() => {
        mockedFetchPublicAppsForPortal.mockRejectedValue(error);
      });

      it('should throw a PromptExitError with an error code', async () => {
        const promise = selectPublicAppForMigrationPrompt({
          accountId: ACCOUNT_ID,
          accountName: ACCOUNT_NAME,
        });

        await expect(promise).rejects.toThrow(PromptExitError);
        await expect(promise).rejects.toMatchObject({
          message:
            lib.prompts.selectPublicAppForMigrationPrompt.errors
              .errorFetchingApps,
          exitCode: EXIT_CODES.ERROR,
        });
      });

      it('should log the error', async () => {
        await expect(
          selectPublicAppForMigrationPrompt({
            accountId: ACCOUNT_ID,
            accountName: ACCOUNT_NAME,
          })
        ).rejects.toThrow(PromptExitError);

        expect(mockedLogError).toHaveBeenCalledWith(error, {
          accountId: ACCOUNT_ID,
        });
        expect(uiLogger.error).toHaveBeenCalledWith(
          lib.prompts.selectPublicAppForMigrationPrompt.errors.errorFetchingApps
        );
      });
    });
  });
});

import { uiLogger } from '../ui/logger.js';
import { initiateSync } from '@hubspot/local-dev-lib/api/sandboxSync';
import {
  getConfigAccountIfExists,
  getConfigAccountById,
} from '@hubspot/local-dev-lib/config';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import { Environment } from '@hubspot/local-dev-lib/types/Config';
import { mockHubSpotHttpError } from '../testUtils.js';
import { getAvailableSyncTypes } from '../sandboxes.js';
import { syncSandbox } from '../sandboxSync.js';
import SpinniesManager from '../ui/SpinniesManager.js';
import { Mock, Mocked } from 'vitest';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';

vi.mock('../ui/logger.js');
vi.mock('@hubspot/local-dev-lib/api/sandboxSync');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../sandboxes');
vi.mock('../ui/SpinniesManager');

const mockedUiLogger = uiLogger as Mocked<typeof uiLogger>;
const mockedInitiateSync = initiateSync as Mock;
const mockedGetConfigAccountIfExists = getConfigAccountIfExists as Mock;
const mockedGetConfigAccountById = getConfigAccountById as Mock;
const mockedGetAvailableSyncTypes = getAvailableSyncTypes as Mock;
const mockedSpinniesInit = SpinniesManager.init as Mock;
const mockedSpinniesAdd = SpinniesManager.add as Mock;
const mockedSpinniesSucceed = SpinniesManager.succeed as Mock;
const mockedSpinniesFail = SpinniesManager.fail as Mock;

describe('lib/sandboxSync', () => {
  const mockEnv = 'qa' as Environment;
  const mockParentAccount = {
    name: 'Parent Account',
    accountId: 123,
    accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
    env: mockEnv,
    authType: 'personalaccesskey' as const,
  } as HubSpotConfigAccount;
  const mockChildAccount = {
    name: 'Child Account',
    accountId: 456,
    accountType: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
    env: mockEnv,
    authType: 'personalaccesskey' as const,
  } as HubSpotConfigAccount;
  const mockChildAccountWithMissingId = {
    name: 'Child Account',
    accountType: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
    env: mockEnv,
    authType: 'personalaccesskey' as const,
  } as HubSpotConfigAccount;
  const mockSyncTasks = [{ type: 'mock-sync-type' }];

  beforeEach(() => {
    mockedGetConfigAccountIfExists
      .mockReturnValueOnce(mockChildAccount)
      .mockReturnValueOnce(mockParentAccount);
    mockedGetAvailableSyncTypes.mockResolvedValue(mockSyncTasks);

    // Mock SpinniesManager methods to prevent spinner errors
    mockedSpinniesInit.mockImplementation(() => {});
    mockedSpinniesAdd.mockImplementation(() => {});
    mockedSpinniesSucceed.mockImplementation(() => {});
    mockedSpinniesFail.mockImplementation(() => {});

    // Mock account config for uiAccountDescription calls
    mockedGetConfigAccountById.mockImplementation(accountId => {
      if (accountId === mockChildAccount.accountId) {
        return mockChildAccount;
      }
      if (accountId === mockParentAccount.accountId) {
        return mockParentAccount;
      }
      return undefined; // Don't throw, just return undefined for unknown accounts
    });
  });

  describe('syncSandbox()', () => {
    it('successfully syncs a sandbox with provided sync tasks', async () => {
      mockedInitiateSync.mockResolvedValue({ status: 'SUCCESS' });

      await syncSandbox(
        mockChildAccount,
        mockParentAccount,
        mockEnv,
        mockSyncTasks
      );

      expect(mockedSpinniesInit).toHaveBeenCalled();
      expect(mockedSpinniesAdd).toHaveBeenCalled();
      expect(mockedInitiateSync).toHaveBeenCalledWith(
        mockParentAccount.accountId,
        mockChildAccount.accountId,
        mockSyncTasks,
        mockChildAccount.accountId
      );
      expect(mockedSpinniesSucceed).toHaveBeenCalled();
    });

    it('fetches sync types when no tasks are provided', async () => {
      mockedInitiateSync.mockResolvedValue({ status: 'SUCCESS' });

      await syncSandbox(mockChildAccount, mockParentAccount, mockEnv, []);

      expect(mockedGetAvailableSyncTypes).toHaveBeenCalledWith(
        mockParentAccount,
        mockChildAccount
      );

      expect(mockedGetAvailableSyncTypes).toHaveBeenCalledWith(
        mockParentAccount,
        mockChildAccount
      );
      expect(mockedInitiateSync).toHaveBeenCalled();
    });

    it('throws error when account IDs are missing', async () => {
      const errorRegex = new RegExp(
        `because your account has been removed from`
      );
      await expect(
        syncSandbox(
          mockChildAccountWithMissingId,
          mockParentAccount,
          mockEnv,
          mockSyncTasks
        )
      ).rejects.toThrow(errorRegex);
    });

    it('handles sync in progress error', async () => {
      const error = mockHubSpotHttpError('', {
        status: 429,
        data: {
          category: 'RATE_LIMITS',
          subCategory: 'sandboxes-sync-api.SYNC_IN_PROGRESS',
        },
      });

      mockedInitiateSync.mockRejectedValue(error);

      await expect(
        syncSandbox(mockChildAccount, mockParentAccount, mockEnv, mockSyncTasks)
      ).rejects.toEqual(error);

      expect(mockedSpinniesFail).toHaveBeenCalled();
      expect(mockedUiLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /Couldn't run the sync because there's another sync in progress/
        )
      );
    });

    it('handles invalid user error', async () => {
      const error = mockHubSpotHttpError('', {
        status: 403,
        data: {
          category: 'BANNED',
          subCategory: 'sandboxes-sync-api.SYNC_NOT_ALLOWED_INVALID_USER',
        },
      });

      mockedInitiateSync.mockRejectedValue(error);

      await expect(
        syncSandbox(mockChildAccount, mockParentAccount, mockEnv, mockSyncTasks)
      ).rejects.toEqual(error);

      expect(mockedSpinniesFail).toHaveBeenCalled();
      expect(mockedUiLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(/because your account has been removed from/)
      );
    });

    it('handles not super admin error', async () => {
      const error = mockHubSpotHttpError('', {
        status: 403,
        data: {
          category: 'BANNED',
          subCategory: 'sandboxes-sync-api.SYNC_NOT_ALLOWED_INVALID_USERID',
        },
      });

      mockedInitiateSync.mockRejectedValue(error);

      await expect(
        syncSandbox(mockChildAccount, mockParentAccount, mockEnv, mockSyncTasks)
      ).rejects.toEqual(error);

      expect(mockedSpinniesFail).toHaveBeenCalled();
      expect(mockedUiLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /Couldn't run the sync because you are not a super admin in/
        )
      );
    });

    it('handles sandbox not found error', async () => {
      const error = mockHubSpotHttpError('', {
        status: 404,
        data: {
          category: 'OBJECT_NOT_FOUND',
          subCategory: 'SandboxErrors.SANDBOX_NOT_FOUND',
        },
      });

      mockedInitiateSync.mockRejectedValue(error);

      await expect(
        syncSandbox(mockChildAccount, mockParentAccount, mockEnv, mockSyncTasks)
      ).rejects.toEqual(error);

      expect(mockedSpinniesFail).toHaveBeenCalled();
      expect(mockedUiLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(/may have been deleted through the UI/)
      );
    });

    it('displays slim info message when specified', async () => {
      mockedInitiateSync.mockResolvedValue({ status: 'SUCCESS' });

      await syncSandbox(
        mockChildAccount,
        mockParentAccount,
        mockEnv,
        mockSyncTasks,
        true
      );

      expect(mockedUiLogger.info).not.toHaveBeenCalled();
      expect(mockedSpinniesSucceed).toHaveBeenCalledWith(
        'sandboxSync',
        expect.objectContaining({
          text: expect.stringMatching(
            /Initiated sync of object definitions from production to /
          ),
        })
      );
    });
  });
});

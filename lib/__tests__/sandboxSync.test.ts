import { logger } from '@hubspot/local-dev-lib/logger';
import { initiateSync } from '@hubspot/local-dev-lib/api/sandboxSync';
import { getAccountId } from '@hubspot/local-dev-lib/config';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import { Environment } from '@hubspot/local-dev-lib/types/Config';
import { mockHubSpotHttpError } from '../testUtils.js';
import { getAvailableSyncTypes } from '../sandboxes.js';
import { syncSandbox } from '../sandboxSync.js';
import SpinniesManager from '../ui/SpinniesManager.js';
import { Mock, Mocked } from 'vitest';

vi.mock('@hubspot/local-dev-lib/logger');
vi.mock('@hubspot/local-dev-lib/api/sandboxSync');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../sandboxes');
vi.mock('../ui/SpinniesManager');

const mockedLogger = logger as Mocked<typeof logger>;
const mockedInitiateSync = initiateSync as Mock;
const mockedGetAccountId = getAccountId as Mock;
const mockedGetAvailableSyncTypes = getAvailableSyncTypes as Mock;
const mockedSpinniesInit = SpinniesManager.init as Mock;
const mockedSpinniesAdd = SpinniesManager.add as Mock;
const mockedSpinniesSucceed = SpinniesManager.succeed as Mock;
const mockedSpinniesFail = SpinniesManager.fail as Mock;

describe('lib/sandboxSync', () => {
  const mockEnv = 'qa' as Environment;
  const mockParentAccount = {
    name: 'Parent Account',
    portalId: 123,
    accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
    env: mockEnv,
  };
  const mockChildAccount = {
    name: 'Child Account',
    portalId: 456,
    accountType: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
    env: mockEnv,
  };
  const mockSyncTasks = [{ type: 'mock-sync-type' }];

  beforeEach(() => {
    mockedGetAccountId
      .mockReturnValueOnce(mockChildAccount.portalId)
      .mockReturnValueOnce(mockParentAccount.portalId);
    mockedGetAvailableSyncTypes.mockResolvedValue(mockSyncTasks);
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
        mockParentAccount.portalId,
        mockChildAccount.portalId,
        mockSyncTasks,
        mockChildAccount.portalId
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
      mockedGetAccountId.mockReset();
      mockedGetAccountId.mockReturnValue(null);

      const errorRegex = new RegExp(
        `Couldn't sync ${mockChildAccount.portalId} because your account has been removed from`
      );

      await expect(
        syncSandbox(mockChildAccount, mockParentAccount, mockEnv, mockSyncTasks)
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
      expect(mockedLogger.error).toHaveBeenCalledWith(
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
      expect(mockedLogger.error).toHaveBeenCalledWith(
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
      expect(mockedLogger.error).toHaveBeenCalledWith(
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
      expect(mockedLogger.error).toHaveBeenCalledWith(
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

      expect(mockedLogger.info).not.toHaveBeenCalled();
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

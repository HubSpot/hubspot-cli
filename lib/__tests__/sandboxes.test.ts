import { logger } from '@hubspot/local-dev-lib/logger';
import { HubSpotHttpError } from '@hubspot/local-dev-lib/models/HubSpotHttpError';
import { getSandboxUsageLimits } from '@hubspot/local-dev-lib/api/sandboxHubs';
import { fetchTypes } from '@hubspot/local-dev-lib/api/sandboxSync';
import { getAccountId, getConfigAccounts } from '@hubspot/local-dev-lib/config';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import { Environment } from '@hubspot/local-dev-lib/types/Config';
import {
  getSandboxTypeAsString,
  getHasSandboxesByType,
  getAvailableSyncTypes,
  validateSandboxUsageLimits,
  handleSandboxCreateError,
} from '../sandboxes';

jest.mock('@hubspot/local-dev-lib/logger');
jest.mock('@hubspot/local-dev-lib/api/sandboxHubs');
jest.mock('@hubspot/local-dev-lib/api/sandboxSync');
jest.mock('@hubspot/local-dev-lib/config');

const mockedGetAccountId = getAccountId as jest.Mock;
const mockedGetSandboxUsageLimits = getSandboxUsageLimits as jest.Mock;
const mockedFetchTypes = fetchTypes as jest.Mock;
const mockedGetConfigAccounts = getConfigAccounts as jest.Mock;
const mockedLogger = logger as jest.Mocked<typeof logger>;

describe('lib/sandboxes', () => {
  describe('getSandboxTypeAsString()', () => {
    it('returns "development" for development sandbox type', () => {
      expect(
        getSandboxTypeAsString(HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX)
      ).toBe('development');
    });

    it('returns "standard" for standard sandbox type', () => {
      expect(
        getSandboxTypeAsString(HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX)
      ).toBe('standard');
    });

    it('returns "standard" for undefined input', () => {
      expect(getSandboxTypeAsString(undefined)).toBe('standard');
    });
  });

  describe('getHasSandboxesByType()', () => {
    const mockParentAccount = {
      name: 'Parent Account',
      portalId: 123,
      authType: undefined,
      accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
      env: 'qa' as Environment,
    };

    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('returns true when sandbox of specified type exists', () => {
      mockedGetAccountId.mockReturnValue(mockParentAccount.portalId);
      mockedGetConfigAccounts.mockReturnValue([
        mockParentAccount,
        {
          ...mockParentAccount,
          parentAccountId: 123,
          accountType: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
        },
      ]);

      expect(
        getHasSandboxesByType(
          mockParentAccount,
          HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX
        )
      ).toBe(true);
    });

    it('returns false when no sandbox of specified type exists', () => {
      mockedGetConfigAccounts.mockReturnValue([mockParentAccount]);

      expect(
        getHasSandboxesByType(
          mockParentAccount,
          HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX
        )
      ).toBe(false);
    });
  });

  describe('getAvailableSyncTypes()', () => {
    const mockParentAccount = {
      name: 'Parent Account',
      portalId: 123,
      env: 'qa' as Environment,
    };

    const mockChildAccount = {
      ...mockParentAccount,
      portalId: 456,
    };

    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('returns available sync types when fetch is successful', async () => {
      const mockSyncTypes = [{ name: 'type1' }, { name: 'type2' }];
      mockedGetAccountId
        .mockReturnValue(mockParentAccount.portalId)
        .mockReturnValue(mockChildAccount.portalId);
      mockedFetchTypes.mockResolvedValue({
        data: { results: mockSyncTypes },
      });

      const result = await getAvailableSyncTypes(
        mockParentAccount,
        mockChildAccount
      );

      expect(result).toEqual([{ type: 'type1' }, { type: 'type2' }]);
    });

    it('throws error when sync types fetch fails', async () => {
      mockedFetchTypes.mockResolvedValue({ data: { results: null } });

      await expect(
        getAvailableSyncTypes(mockParentAccount, mockChildAccount)
      ).rejects.toThrow();
    });
  });

  describe('validateSandboxUsageLimits()', () => {
    const mockAccount = {
      name: 'Test Account',
      portalId: 123,
      authType: undefined,
      env: 'qa' as Environment,
    };

    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('validates successfully when limits are not reached', async () => {
      mockedGetAccountId.mockReturnValue(mockAccount.portalId);
      mockedGetSandboxUsageLimits.mockResolvedValue({
        data: {
          usage: { DEVELOPER: { available: 1, limit: 3 } },
        },
      });

      await expect(
        validateSandboxUsageLimits(
          mockAccount,
          HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
          'qa'
        )
      ).resolves.not.toThrow();
    });

    it('throws error when development sandbox limit is reached', async () => {
      mockedGetAccountId.mockReturnValue(mockAccount.portalId);
      mockedGetConfigAccounts.mockReturnValue([]);
      mockedGetSandboxUsageLimits.mockResolvedValue({
        data: {
          usage: { DEVELOPER: { available: 0, limit: 1 } },
        },
      });

      await expect(
        validateSandboxUsageLimits(
          mockAccount,
          HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
          'qa'
        )
      ).rejects.toThrow();
    });
  });

  describe('handleSandboxCreateError()', () => {
    const mockEnv = 'qa' as Environment;
    const mockName = 'Test Sandbox';
    const mockAccountId = 123;

    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('handles missing scope error', () => {
      const error = new HubSpotHttpError('missing scopes error', {
        cause: {
          isAxiosError: true,
          response: {
            status: 403,
            data: {
              message: 'Missing scopes error',
              category: 'MISSING_SCOPES',
            },
          },
        },
      });

      expect(() =>
        handleSandboxCreateError(error, mockEnv, mockName, mockAccountId)
      ).toThrow();
      expect(mockedLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /The personal access key you provided doesn't include sandbox permissions/
        )
      );
      expect(mockedLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(/To update CLI permissions for/)
      );
    });

    it('handles user access not allowed error', () => {
      const error = new HubSpotHttpError('user access not allowed error', {
        cause: {
          isAxiosError: true,
          response: {
            status: 403,
            data: {
              category: 'BANNED',
              subCategory: 'SandboxErrors.USER_ACCESS_NOT_ALLOWED',
            },
          },
        },
      });

      expect(() =>
        handleSandboxCreateError(error, mockEnv, mockName, mockAccountId)
      ).toThrow();
      expect(mockedLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /your permission set doesn't allow you to create the sandbox/
        )
      );
    });

    it('handles 403 gating error', () => {
      const error = new HubSpotHttpError('403 gating error', {
        cause: {
          isAxiosError: true,
          response: {
            status: 403,
            data: {
              category: 'BANNED',
              subCategory:
                'SandboxErrors.DEVELOPMENT_SANDBOX_ACCESS_NOT_ALLOWED',
            },
          },
        },
      });

      expect(() =>
        handleSandboxCreateError(error, mockEnv, mockName, mockAccountId)
      ).toThrow();
      expect(mockedLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(/does not have access to development sandboxes/)
      );
    });
  });
});

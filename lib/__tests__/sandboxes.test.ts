import { uiLogger } from '../ui/logger.js';
import { getSandboxUsageLimits } from '@hubspot/local-dev-lib/api/sandboxHubs';
import {
  getAllConfigAccounts,
  getConfigAccountIfExists,
} from '@hubspot/local-dev-lib/config';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import { Environment } from '@hubspot/local-dev-lib/types/Accounts';
import { mockHubSpotHttpError } from '../testUtils.js';
import {
  getSandboxTypeAsString,
  getHasSandboxesByType,
  validateSandboxUsageLimits,
  handleSandboxCreateError,
} from '../sandboxes.js';
import {
  isMissingScopeError,
  isSpecifiedError,
} from '@hubspot/local-dev-lib/errors/index';
import { Mock, Mocked, MockedFunction } from 'vitest';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';

vi.mock('@hubspot/local-dev-lib/api/sandboxHubs');
vi.mock('@hubspot/local-dev-lib/api/sandboxSync');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('@hubspot/local-dev-lib/errors/index');

const mockedGetConfigAccountIfExists = getConfigAccountIfExists as Mock;
const mockedGetSandboxUsageLimits = getSandboxUsageLimits as Mock;
const mockedGetAllConfigAccounts = getAllConfigAccounts as Mock;
const mockedUiLogger = uiLogger as Mocked<typeof uiLogger>;
const mockedIsMissingScopeError =
  isMissingScopeError as unknown as MockedFunction<typeof isMissingScopeError>;
const mockedIsSpecifiedError = isSpecifiedError as unknown as MockedFunction<
  typeof isSpecifiedError
>;

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
      accountId: 123,
      accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
      env: 'qa' as Environment,
    } as HubSpotConfigAccount;

    it('returns true when sandbox of specified type exists', () => {
      mockedGetConfigAccountIfExists.mockReturnValue(mockParentAccount);
      mockedGetAllConfigAccounts.mockReturnValue([
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
      mockedGetAllConfigAccounts.mockReturnValue([mockParentAccount]);

      expect(
        getHasSandboxesByType(
          mockParentAccount,
          HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX
        )
      ).toBe(false);
    });
  });

  describe('validateSandboxUsageLimits()', () => {
    const mockAccount = {
      name: 'Test Account',
      accountId: 123,
      env: 'qa' as Environment,
    } as HubSpotConfigAccount;

    it('validates successfully when limits are not reached', async () => {
      mockedGetConfigAccountIfExists.mockReturnValue(mockAccount.accountId);
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
      mockedGetConfigAccountIfExists.mockReturnValue(mockAccount.accountId);
      mockedGetAllConfigAccounts.mockReturnValue([]);
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
      ).rejects.toThrow(/reached the limit of 1 developer sandboxes/);
    });
  });

  describe('handleSandboxCreateError()', () => {
    const mockEnv = 'qa' as Environment;
    const mockName = 'Test Sandbox';
    const mockAccountId = 123;

    it('handles missing scope error', () => {
      const error = mockHubSpotHttpError('missing scopes error', {
        status: 403,
        data: {
          message: 'Missing scopes error',
          category: 'MISSING_SCOPES',
        },
      });

      // Mock the error checking function to return true for missing scope error
      mockedIsMissingScopeError.mockReturnValue(true);
      mockedIsSpecifiedError.mockReturnValue(false);

      expect(() =>
        handleSandboxCreateError(error, mockEnv, mockName, mockAccountId)
      ).toThrow(error);
      expect(mockedUiLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /The personal access key you provided doesn't include sandbox permissions/
        )
      );
      expect(mockedUiLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(/To update CLI permissions for/)
      );
    });

    it('handles user access not allowed error', () => {
      const error = mockHubSpotHttpError('user access not allowed error', {
        status: 403,
        data: {
          category: 'BANNED',
          subCategory: 'SandboxErrors.USER_ACCESS_NOT_ALLOWED',
        },
      });

      // Mock the error checking function to return true for this error type
      mockedIsMissingScopeError.mockReturnValue(false);
      mockedIsSpecifiedError.mockReturnValue(true);

      expect(() =>
        handleSandboxCreateError(error, mockEnv, mockName, mockAccountId)
      ).toThrow(error);
      expect(mockedUiLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /your permission set doesn't allow you to create the sandbox/
        )
      );
    });

    it('handles 403 gating error', () => {
      const error = mockHubSpotHttpError('403 gating error', {
        status: 403,
        data: {
          category: 'BANNED',
          subCategory: 'SandboxErrors.DEVELOPMENT_SANDBOX_ACCESS_NOT_ALLOWED',
        },
      });

      // Mock the error checking function to return true for this error type
      mockedIsMissingScopeError.mockReturnValue(false);
      mockedIsSpecifiedError.mockReturnValue(true);

      expect(() =>
        handleSandboxCreateError(error, mockEnv, mockName, mockAccountId)
      ).toThrow(error);
      expect(mockedUiLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /Couldn't create.*because your account has been removed from.*or your permission set doesn't allow you to create/
        )
      );
    });
  });
});

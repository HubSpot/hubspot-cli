import {
  getAllConfigAccounts,
  getConfigAccountIfExists,
  getConfigAccountById,
} from '@hubspot/local-dev-lib/config';
import { uiLogger } from '../ui/logger.js';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import { fetchDeveloperTestAccounts } from '@hubspot/local-dev-lib/api/developerTestAccounts';
import { mockHubSpotHttpError } from '../testUtils.js';
import * as errorHandlers from '../errorHandlers/index.js';
import {
  getHasDevTestAccounts,
  handleDeveloperTestAccountCreateError,
  validateDevTestAccountUsageLimits,
} from '../developerTestAccounts.js';
import { Mock } from 'vitest';
import { logError } from '../errorHandlers/index.js';

vi.mock('@hubspot/local-dev-lib/config');
vi.mock('@hubspot/local-dev-lib/api/developerTestAccounts');
vi.mock('../errorHandlers');

const mockedGetConfigAccountIfExists = getConfigAccountIfExists as Mock;
const mockedGetAllConfigAccounts = getAllConfigAccounts as Mock;
const mockedGetConfigAccountById = getConfigAccountById as Mock;
const mockedFetchDeveloperTestAccounts = fetchDeveloperTestAccounts as Mock;

const APP_DEVELOPER_ACCOUNT_1: HubSpotConfigAccount = {
  name: 'app-developer-1',
  accountId: 123,
  accountType: HUBSPOT_ACCOUNT_TYPES.APP_DEVELOPER,
  env: 'prod',
} as HubSpotConfigAccount;

const APP_DEVELOPER_ACCOUNT_2: HubSpotConfigAccount = {
  name: 'app-developer-2',
  accountId: 456,
  accountType: HUBSPOT_ACCOUNT_TYPES.APP_DEVELOPER,
  env: 'prod',
} as HubSpotConfigAccount;

const accounts: HubSpotConfigAccount[] = [
  APP_DEVELOPER_ACCOUNT_1,
  APP_DEVELOPER_ACCOUNT_2,
  {
    name: 'test-account',
    accountId: 789,
    parentAccountId: APP_DEVELOPER_ACCOUNT_1.accountId,
    accountType: HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST,
    env: 'prod',
    authType: 'personalaccesskey' as const,
  } as HubSpotConfigAccount,
];

describe('lib/developerTestAccounts', () => {
  describe('getHasDevTestAccounts()', () => {
    it('should return true if there are developer test accounts associated with the account', () => {
      mockedGetAllConfigAccounts.mockReturnValueOnce(accounts);

      const result = getHasDevTestAccounts(APP_DEVELOPER_ACCOUNT_1);
      expect(result).toBe(true);
    });

    it('should return false if there are no developer test accounts associated with the account', () => {
      mockedGetConfigAccountIfExists.mockReturnValueOnce(
        APP_DEVELOPER_ACCOUNT_2
      );
      mockedGetAllConfigAccounts.mockReturnValueOnce(accounts);

      const result = getHasDevTestAccounts(APP_DEVELOPER_ACCOUNT_2);
      expect(result).toBe(false);
    });

    it('should return false if there are no accounts configured', () => {
      mockedGetConfigAccountIfExists.mockReturnValueOnce(
        APP_DEVELOPER_ACCOUNT_1
      );
      mockedGetAllConfigAccounts.mockReturnValueOnce(undefined);

      const result = getHasDevTestAccounts(APP_DEVELOPER_ACCOUNT_1);
      expect(result).toBe(false);
    });
  });

  describe('validateDevTestAccountUsageLimits()', () => {
    afterEach(() => {
      mockedGetConfigAccountIfExists.mockRestore();
      mockedFetchDeveloperTestAccounts.mockRestore();
    });

    it('should return null if the account id is not found', async () => {
      mockedFetchDeveloperTestAccounts.mockResolvedValueOnce({
        data: null,
      });

      const result = await validateDevTestAccountUsageLimits(
        APP_DEVELOPER_ACCOUNT_1
      );
      expect(result).toBe(null);
    });

    it('should return null if there is no developer test account data', async () => {
      mockedGetConfigAccountIfExists.mockReturnValueOnce(
        APP_DEVELOPER_ACCOUNT_1
      );
      mockedFetchDeveloperTestAccounts.mockResolvedValueOnce({
        data: null,
      });

      const result = await validateDevTestAccountUsageLimits(
        APP_DEVELOPER_ACCOUNT_1
      );
      expect(result).toBe(null);
    });

    it('should return the test account data if the account has not reached the limit', async () => {
      mockedGetConfigAccountIfExists.mockReturnValueOnce(
        APP_DEVELOPER_ACCOUNT_1
      );
      const testAccountData = {
        maxTestPortals: 10,
        results: [],
      };
      mockedFetchDeveloperTestAccounts.mockResolvedValueOnce({
        data: testAccountData,
      });

      const result = await validateDevTestAccountUsageLimits(
        APP_DEVELOPER_ACCOUNT_1
      );
      expect(result).toEqual(expect.objectContaining(testAccountData));
    });

    it('should throw an error if the account has reached the limit', async () => {
      mockedGetConfigAccountIfExists.mockReturnValueOnce(
        APP_DEVELOPER_ACCOUNT_1
      );
      mockedFetchDeveloperTestAccounts.mockResolvedValueOnce({
        data: {
          maxTestPortals: 0,
          results: [{}],
        },
      });

      await expect(
        validateDevTestAccountUsageLimits(APP_DEVELOPER_ACCOUNT_1)
      ).rejects.toThrow();
    });
  });

  describe('handleDeveloperTestAccountCreateError()', () => {
    let loggerErrorSpy: Mock<typeof uiLogger.error>;
    let logErrorSpy: Mock<typeof logError>;

    beforeEach(() => {
      loggerErrorSpy = vi.spyOn(uiLogger, 'error') as Mock<
        typeof uiLogger.error
      >;
      logErrorSpy = vi.spyOn(errorHandlers, 'logError') as Mock<
        typeof logError
      >;

      // Mock account config for uiAccountDescription calls
      mockedGetConfigAccountById.mockReturnValue({
        accountId: APP_DEVELOPER_ACCOUNT_1.accountId,
        name: 'Test Account',
        authType: 'personalaccesskey',
        personalAccessKey: 'test-key',
        env: 'prod',
      });
    });

    afterEach(() => {
      loggerErrorSpy.mockRestore();
      logErrorSpy.mockRestore();
    });

    it('should log and throw an error if the account is missing the required scopes', () => {
      const missingScopesError = mockHubSpotHttpError('Missing scopes error', {
        status: 403,
        data: {
          message: 'Missing scopes error',
          category: 'MISSING_SCOPES',
        },
      });

      expect(() =>
        handleDeveloperTestAccountCreateError(
          missingScopesError,
          APP_DEVELOPER_ACCOUNT_1.accountId,
          'prod',
          10
        )
      ).toThrow('Missing scopes error');
      expect(uiLogger.error).toHaveBeenCalled();
    });

    it('should log and throw an error if the account is missing the required scopes', () => {
      const portalLimitReachedError = mockHubSpotHttpError(
        'Portal limit reached error',
        {
          status: 400,
          data: {
            message: 'Portal limit reached error',
            errorType: 'TEST_PORTAL_LIMIT_REACHED',
          },
        }
      );

      expect(() =>
        handleDeveloperTestAccountCreateError(
          portalLimitReachedError,
          APP_DEVELOPER_ACCOUNT_1.accountId,
          'prod',
          10
        )
      ).toThrow('Portal limit reached error');
      expect(uiLogger.error).toHaveBeenCalled();
    });

    it('should log a generic error message for an unknown error type', () => {
      const someUnknownError = mockHubSpotHttpError('Some unknown error', {
        status: 400,
        data: {
          message: 'Some unknown error',
          category: 'SOME_UNKNOWN_ERROR',
        },
      });

      expect(() =>
        handleDeveloperTestAccountCreateError(
          someUnknownError,
          APP_DEVELOPER_ACCOUNT_1.accountId,
          'prod',
          10
        )
      ).toThrow('Some unknown error');
      expect(logError).toHaveBeenCalled();
    });
  });
});

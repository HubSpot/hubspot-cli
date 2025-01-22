import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import {
  isStandardAccount,
  isSandbox,
  isStandardSandbox,
  isDevelopmentSandbox,
  isDeveloperTestAccount,
  isAppDeveloperAccount,
} from '../accountTypes';

const STANDARD_ACCOUNT: CLIAccount = {
  name: 'standard-account',
  accountId: 123,
  accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD,
  env: 'prod',
};

const DEVELOPMENT_SANDBOX_ACCOUNT: CLIAccount = {
  name: 'development-sandbox-account',
  accountId: 456,
  accountType: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
  env: 'prod',
};

const STANDARD_SANDBOX_ACCOUNT: CLIAccount = {
  name: 'sandbox-account',
  accountId: 456,
  accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
  env: 'prod',
};

const DEVELOPER_TEST_ACCOUNT: CLIAccount = {
  name: 'developer-test-account',
  accountId: 789,
  accountType: HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST,
  env: 'prod',
};

const APP_DEVELOPER_ACCOUNT: CLIAccount = {
  name: 'app-developer-account',
  accountId: 1011,
  accountType: HUBSPOT_ACCOUNT_TYPES.APP_DEVELOPER,
  env: 'prod',
};

describe('lib/accountTypes', () => {
  describe('isStandardAccount()', () => {
    it('should return true if the account is a standard account', () => {
      const result = isStandardAccount(STANDARD_ACCOUNT);
      expect(result).toBe(true);
    });

    it('should return false if the account is not a standard account', () => {
      const result = isStandardAccount(DEVELOPER_TEST_ACCOUNT);
      expect(result).toBe(false);
    });
  });

  describe('isSandbox()', () => {
    it('should return true if the account is a standard sandbox account', () => {
      const result = isSandbox(STANDARD_SANDBOX_ACCOUNT);
      expect(result).toBe(true);
    });

    it('should return true if the account is a development sandbox account', () => {
      const result = isSandbox(DEVELOPMENT_SANDBOX_ACCOUNT);
      expect(result).toBe(true);
    });

    it('should return false if the account is not a sandbox account', () => {
      const result = isSandbox(STANDARD_ACCOUNT);
      expect(result).toBe(false);
    });
  });

  describe('isStandardSandbox()', () => {
    it('should return true if the account is a standard sandbox account', () => {
      const result = isStandardSandbox(STANDARD_SANDBOX_ACCOUNT);
      expect(result).toBe(true);
    });

    it('should return false if the account is not a standard sandbox account', () => {
      const result = isStandardSandbox(DEVELOPMENT_SANDBOX_ACCOUNT);
      expect(result).toBe(false);
    });
  });

  describe('isDevelopmentSandbox()', () => {
    it('should return true if the account is a development sandbox account', () => {
      const result = isDevelopmentSandbox(DEVELOPMENT_SANDBOX_ACCOUNT);
      expect(result).toBe(true);
    });

    it('should return false if the account is not a development sandbox account', () => {
      const result = isDevelopmentSandbox(STANDARD_ACCOUNT);
      expect(result).toBe(false);
    });
  });

  describe('isDeveloperTestAccount()', () => {
    it('should return true if the account is a developer test account', () => {
      const result = isDeveloperTestAccount(DEVELOPER_TEST_ACCOUNT);
      expect(result).toBe(true);
    });

    it('should return false if the account is not a developer test account', () => {
      const result = isDeveloperTestAccount(STANDARD_ACCOUNT);
      expect(result).toBe(false);
    });
  });

  describe('isAppDeveloperAccount()', () => {
    it('should return true if the account is an app developer account', () => {
      const result = isAppDeveloperAccount(APP_DEVELOPER_ACCOUNT);
      expect(result).toBe(true);
    });

    it('should return false if the account is not an app developer account', () => {
      const result = isAppDeveloperAccount(STANDARD_ACCOUNT);
      expect(result).toBe(false);
    });
  });
});

const { getAccountConfig } = require('@hubspot/local-dev-lib/config');
const { getOauthManager } = require('@hubspot/cli-lib/oauth');
const {
  accessTokenForPersonalAccessKey,
} = require('@hubspot/cli-lib/personalAccessKey');

const { getAccountId } = require('../commonOpts');
const { validateAccount } = require('../validation');

jest.mock('@hubspot/cli-lib');
jest.mock('@hubspot/local-dev-lib/config');
jest.mock('@hubspot/cli-lib/logger');
jest.mock('@hubspot/cli-lib/oauth');
jest.mock('@hubspot/cli-lib/personalAccessKey');
jest.mock('../commonOpts');

describe('validation', () => {
  describe('validateAccount', () => {
    it('returns false if an account is missing', async () => {
      getAccountId.mockReturnValueOnce(null);
      expect(await validateAccount({ account: 123 })).toBe(false);
    });
    it('returns false if an account config is missing', async () => {
      getAccountId.mockReturnValueOnce(123);
      getAccountConfig.mockReturnValueOnce(undefined);
      expect(await validateAccount({ account: 123 })).toBe(false);
    });
    it('returns false for oauth2 authType if auth is missing', async () => {
      getAccountId.mockReturnValueOnce(123);
      getAccountConfig.mockReturnValueOnce({
        accountId: 123,
        authType: 'oauth2',
      });
      expect(await validateAccount({ account: 123 })).toBe(false);
    });
    it('returns false if OAuth is missing configuration', async () => {
      getAccountId.mockReturnValueOnce(123);
      getAccountConfig.mockReturnValueOnce({
        accountId: 123,
        authType: 'oauth2',
        auth: {
          clientId: 'foo',
        },
      });
      expect(await validateAccount({ account: 123 })).toBe(false);
    });
    it('returns false if an access token was not retrieved', async () => {
      getAccountId.mockReturnValueOnce(123);
      getOauthManager.mockReturnValueOnce({
        accessToken() {
          return null;
        },
      });
      getAccountConfig.mockReturnValueOnce({
        accountId: 123,
        authType: 'oauth2',
        auth: {
          clientId: 'foo',
          clientSecret: 'abc',
          tokenInfo: {
            refreshToken: 'def',
          },
        },
      });
      expect(await validateAccount({ account: 123 })).toBe(false);
    });
    it('returns false if an getting an access token throws', async () => {
      getAccountId.mockReturnValueOnce(123);
      getOauthManager.mockReturnValueOnce({
        accessToken() {
          throw new Error('It failed');
        },
      });
      getAccountConfig.mockReturnValueOnce({
        accountId: 123,
        authType: 'oauth2',
        auth: {
          clientId: 'foo',
          clientSecret: 'abc',
          tokenInfo: {
            refreshToken: 'def',
          },
        },
      });
      expect(await validateAccount({ account: 123 })).toBe(false);
    });
    it('returns true if OAuth is configured and an access token is received', async () => {
      getAccountId.mockReturnValueOnce(123);
      getOauthManager.mockReturnValueOnce({
        accessToken() {
          return 'yep';
        },
      });
      getAccountConfig.mockReturnValueOnce({
        accountId: 123,
        authType: 'oauth2',
        auth: {
          clientId: 'foo',
          clientSecret: 'abc',
          tokenInfo: {
            refreshToken: 'def',
          },
        },
      });
      expect(await validateAccount({ account: 123 })).toBe(true);
    });
    it('returns false if "personalaccesskey" configured and getting an access token throws', async () => {
      getAccountId.mockReturnValueOnce(123);
      accessTokenForPersonalAccessKey.mockImplementationOnce(() => {
        throw new Error('It failed');
      });
      getAccountConfig.mockReturnValueOnce({
        accountId: 123,
        authType: 'personalaccesskey',
        personalAccessKey: 'foo',
      });
      expect(await validateAccount({ account: 123 })).toBe(false);
    });
    it('returns true if "personalaccesskey" configured and an access token is received', async () => {
      getAccountId.mockReturnValueOnce(123);
      accessTokenForPersonalAccessKey.mockImplementationOnce(() => {
        return 'secret-stuff';
      });
      getAccountConfig.mockReturnValueOnce({
        accountId: 123,
        authType: 'personalaccesskey',
        personalAccessKey: 'foo',
      });
      expect(await validateAccount({ account: 123 })).toBe(true);
    });
    it('returns true if apiKey is configured and present', async () => {
      getAccountId.mockReturnValueOnce(123);
      getAccountConfig.mockReturnValueOnce({
        accountId: 123,
        authType: 'apikey',
        apiKey: 'my-secret-key',
      });
      expect(await validateAccount({ account: 123 })).toBe(true);
    });
  });
});

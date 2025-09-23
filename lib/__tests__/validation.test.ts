import { getAccountId, getAccountConfig } from '@hubspot/local-dev-lib/config';
import { getOauthManager } from '@hubspot/local-dev-lib/oauth';
import { accessTokenForPersonalAccessKey } from '@hubspot/local-dev-lib/personalAccessKey';
import { validateAccount } from '../validation.js';
import { Arguments } from 'yargs';
import { Mock } from 'vitest';

vi.mock('@hubspot/local-dev-lib/config');
vi.mock('@hubspot/local-dev-lib/logger');
vi.mock('@hubspot/local-dev-lib/oauth');
vi.mock('@hubspot/local-dev-lib/personalAccessKey');
vi.mock('../commonOpts');

const yargsOption = (option: { [key: string]: string }): Arguments => ({
  $0: '',
  _: [''],
  ...option,
});

describe('lib/validation', () => {
  const getAccountIdMock = getAccountId as Mock;
  const getAccountConfigMock = getAccountConfig as Mock;
  const getOauthManagerMock = getOauthManager as Mock;
  const accessTokenForPersonalAccessKeyMock =
    accessTokenForPersonalAccessKey as Mock;

  describe('validateAccount', () => {
    it('returns false if an account is missing', async () => {
      getAccountIdMock.mockReturnValueOnce(null);
      expect(await validateAccount(yargsOption({ account: '123' }))).toBe(
        false
      );
    });
    it('returns false if an account config is missing', async () => {
      getAccountIdMock.mockReturnValueOnce('123');
      getAccountConfigMock.mockReturnValueOnce(undefined);
      expect(await validateAccount(yargsOption({ account: '123' }))).toBe(
        false
      );
    });
    it('returns false for oauth2 authType if auth is missing', async () => {
      getAccountIdMock.mockReturnValueOnce('123');
      getAccountConfigMock.mockReturnValueOnce({
        accountId: '123',
        authType: 'oauth2',
      });
      expect(await validateAccount(yargsOption({ account: '123' }))).toBe(
        false
      );
    });
    it('returns false if OAuth is missing configuration', async () => {
      getAccountIdMock.mockReturnValueOnce('123');
      getAccountConfigMock.mockReturnValueOnce({
        accountId: '123',
        authType: 'oauth2',
        auth: {
          clientId: 'foo',
        },
      });
      expect(await validateAccount(yargsOption({ account: '123' }))).toBe(
        false
      );
    });
    it('returns false if an access token was not retrieved', async () => {
      getAccountIdMock.mockReturnValueOnce('123');
      getOauthManagerMock.mockReturnValueOnce({
        accessToken() {
          return null;
        },
      });
      getAccountConfigMock.mockReturnValueOnce({
        accountId: '123',
        authType: 'oauth2',
        auth: {
          clientId: 'foo',
          clientSecret: 'abc',
          tokenInfo: {
            refreshToken: 'def',
          },
        },
      });
      expect(await validateAccount(yargsOption({ account: '123' }))).toBe(
        false
      );
    });
    it('returns false if an getting an access token throws', async () => {
      getAccountIdMock.mockReturnValueOnce('123');
      getOauthManagerMock.mockReturnValueOnce({
        accessToken() {
          throw new Error('It failed');
        },
      });
      getAccountConfigMock.mockReturnValueOnce({
        accountId: '123',
        authType: 'oauth2',
        auth: {
          clientId: 'foo',
          clientSecret: 'abc',
          tokenInfo: {
            refreshToken: 'def',
          },
        },
      });
      expect(await validateAccount(yargsOption({ account: '123' }))).toBe(
        false
      );
    });
    it('returns true if OAuth is configured and an access token is received', async () => {
      getAccountIdMock.mockReturnValueOnce('123');
      getOauthManagerMock.mockReturnValueOnce({
        accessToken() {
          return 'yep';
        },
      });
      getAccountConfigMock.mockReturnValueOnce({
        accountId: '123',
        authType: 'oauth2',
        auth: {
          clientId: 'foo',
          clientSecret: 'abc',
          tokenInfo: {
            refreshToken: 'def',
          },
        },
      });
      expect(await validateAccount(yargsOption({ account: '123' }))).toBe(true);
    });
    it('returns false if "personalaccesskey" configured and getting an access token throws', async () => {
      getAccountIdMock.mockReturnValueOnce('123');
      accessTokenForPersonalAccessKeyMock.mockImplementationOnce(() => {
        throw new Error('It failed');
      });
      getAccountConfigMock.mockReturnValueOnce({
        accountId: '123',
        authType: 'personalaccesskey',
        personalAccessKey: 'foo',
      });
      expect(await validateAccount(yargsOption({ account: '123' }))).toBe(
        false
      );
    });
    it('returns true if "personalaccesskey" configured and an access token is received', async () => {
      getAccountIdMock.mockReturnValueOnce('123');
      accessTokenForPersonalAccessKeyMock.mockImplementationOnce(() => {
        return 'secret-stuff';
      });
      getAccountConfigMock.mockReturnValueOnce({
        accountId: '123',
        authType: 'personalaccesskey',
        personalAccessKey: 'foo',
      });
      expect(await validateAccount(yargsOption({ account: '123' }))).toBe(true);
    });
    it('returns true if apiKey is configured and present', async () => {
      getAccountIdMock.mockReturnValueOnce('123');
      getAccountConfigMock.mockReturnValueOnce({
        accountId: '123',
        authType: 'apikey',
        apiKey: 'my-secret-key',
      });
      expect(await validateAccount(yargsOption({ account: '123' }))).toBe(true);
    });
  });
});

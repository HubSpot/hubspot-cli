import {
  getConfigAccountById,
  getConfigAccountIfExists,
} from '@hubspot/local-dev-lib/config';
import { getOauthManager } from '@hubspot/local-dev-lib/oauth';
import { accessTokenForPersonalAccessKey } from '@hubspot/local-dev-lib/personalAccessKey';
import { accessTokenForInjectedAccessToken } from '@hubspot/local-dev-lib/accessToken';
import { validateAccount } from '../validation.js';
import { Arguments } from 'yargs';
import { Mock } from 'vitest';

vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../errorHandlers/index.js');
vi.mock('@hubspot/local-dev-lib/oauth');
vi.mock('@hubspot/local-dev-lib/personalAccessKey');
vi.mock('@hubspot/local-dev-lib/accessToken');
vi.mock('../commonOpts');

const yargsOption = (option: { [key: string]: string }): Arguments => ({
  $0: '',
  _: [''],
  ...option,
});

describe('lib/validation', () => {
  const getConfigAccountIfExistsMock = getConfigAccountIfExists as Mock;
  const getConfigAccountByIdMock = getConfigAccountById as Mock;
  const getOauthManagerMock = getOauthManager as Mock;
  const accessTokenForPersonalAccessKeyMock =
    accessTokenForPersonalAccessKey as Mock;
  const accessTokenForInjectedAccessTokenMock =
    accessTokenForInjectedAccessToken as Mock;

  describe('validateAccount', () => {
    it('returns false if an account is missing', async () => {
      getConfigAccountIfExistsMock.mockReturnValueOnce(null);
      expect(
        await validateAccount(yargsOption({ derivedAccountId: '123' }))
      ).toBe(false);
    });
    it('returns false if an account config is missing', async () => {
      getConfigAccountIfExistsMock.mockReturnValueOnce('123');
      getConfigAccountByIdMock.mockReturnValueOnce(undefined);
      expect(
        await validateAccount(yargsOption({ derivedAccountId: '123' }))
      ).toBe(false);
    });
    it('returns false for oauth2 authType if auth is missing', async () => {
      getConfigAccountIfExistsMock.mockReturnValueOnce('123');
      getConfigAccountByIdMock.mockReturnValueOnce({
        accountId: '123',
        authType: 'oauth2',
      });
      expect(
        await validateAccount(yargsOption({ derivedAccountId: '123' }))
      ).toBe(false);
    });
    it('returns false if OAuth is missing configuration', async () => {
      getConfigAccountIfExistsMock.mockReturnValueOnce('123');
      getConfigAccountByIdMock.mockReturnValueOnce({
        accountId: '123',
        authType: 'oauth2',
        auth: {
          clientId: 'foo',
        },
      });
      expect(
        await validateAccount(yargsOption({ derivedAccountId: '123' }))
      ).toBe(false);
    });
    it('returns false if an access token was not retrieved', async () => {
      getConfigAccountIfExistsMock.mockReturnValueOnce('123');
      getOauthManagerMock.mockReturnValueOnce({
        accessToken() {
          return null;
        },
      });
      getConfigAccountByIdMock.mockReturnValueOnce({
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
      expect(
        await validateAccount(yargsOption({ derivedAccountId: '123' }))
      ).toBe(false);
    });
    it('returns false if an getting an access token throws', async () => {
      getConfigAccountIfExistsMock.mockReturnValueOnce('123');
      getOauthManagerMock.mockReturnValueOnce({
        accessToken() {
          throw new Error('It failed');
        },
      });
      getConfigAccountByIdMock.mockReturnValueOnce({
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
      expect(
        await validateAccount(yargsOption({ derivedAccountId: '123' }))
      ).toBe(false);
    });
    it('returns true if OAuth is configured and an access token is received', async () => {
      getConfigAccountIfExistsMock.mockReturnValueOnce('123');
      getOauthManagerMock.mockReturnValueOnce({
        accessToken() {
          return 'yep';
        },
      });
      getConfigAccountByIdMock.mockReturnValueOnce({
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
      expect(
        await validateAccount(yargsOption({ derivedAccountId: '123' }))
      ).toBe(true);
    });
    it('returns false if "personalaccesskey" configured and getting an access token throws', async () => {
      getConfigAccountIfExistsMock.mockReturnValueOnce('123');
      accessTokenForPersonalAccessKeyMock.mockImplementationOnce(() => {
        throw new Error('It failed');
      });
      getConfigAccountByIdMock.mockReturnValueOnce({
        accountId: '123',
        authType: 'personalaccesskey',
        personalAccessKey: 'foo',
      });
      expect(
        await validateAccount(yargsOption({ derivedAccountId: '123' }))
      ).toBe(false);
    });
    it('returns true if "personalaccesskey" configured and an access token is received', async () => {
      getConfigAccountIfExistsMock.mockReturnValueOnce('123');
      accessTokenForPersonalAccessKeyMock.mockImplementationOnce(() => {
        return 'secret-stuff';
      });
      getConfigAccountByIdMock.mockReturnValueOnce({
        accountId: '123',
        authType: 'personalaccesskey',
        personalAccessKey: 'foo',
      });
      expect(
        await validateAccount(yargsOption({ derivedAccountId: '123' }))
      ).toBe(true);
    });
    it('returns true if "accesstoken" configured and the access token is usable', async () => {
      getConfigAccountIfExistsMock.mockReturnValueOnce('123');
      accessTokenForInjectedAccessTokenMock.mockReturnValueOnce('injected');
      getConfigAccountByIdMock.mockReturnValueOnce({
        accountId: '123',
        authType: 'accesstoken',
        auth: { tokenInfo: { accessToken: 'injected' } },
      });
      expect(
        await validateAccount(yargsOption({ derivedAccountId: '123' }))
      ).toBe(true);
    });
    it('returns false if "accesstoken" configured and the access token is missing', async () => {
      getConfigAccountIfExistsMock.mockReturnValueOnce('123');
      getConfigAccountByIdMock.mockReturnValueOnce({
        accountId: '123',
        authType: 'accesstoken',
        auth: { tokenInfo: {} },
      });
      expect(
        await validateAccount(yargsOption({ derivedAccountId: '123' }))
      ).toBe(false);
      expect(accessTokenForInjectedAccessTokenMock).not.toHaveBeenCalled();
    });
    it('returns false if "accesstoken" configured and the access token is expired', async () => {
      getConfigAccountIfExistsMock.mockReturnValueOnce('123');
      accessTokenForInjectedAccessTokenMock.mockImplementationOnce(() => {
        throw new Error('expired');
      });
      getConfigAccountByIdMock.mockReturnValueOnce({
        accountId: '123',
        authType: 'accesstoken',
        auth: {
          tokenInfo: {
            accessToken: 'injected',
            expiresAt: '2000-01-01T00:00:00.000Z',
          },
        },
      });
      expect(
        await validateAccount(yargsOption({ derivedAccountId: '123' }))
      ).toBe(false);
    });
    it('returns true if apiKey is configured and present', async () => {
      getConfigAccountIfExistsMock.mockReturnValueOnce('123');
      getConfigAccountByIdMock.mockReturnValueOnce({
        accountId: '123',
        authType: 'apikey',
        apiKey: 'my-secret-key',
      });
      expect(
        await validateAccount(yargsOption({ derivedAccountId: '123' }))
      ).toBe(true);
    });
  });
});

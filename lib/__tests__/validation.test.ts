import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { getOauthManager } from '@hubspot/local-dev-lib/oauth';
import { accessTokenForPersonalAccessKey } from '@hubspot/local-dev-lib/personalAccessKey';
import { getAccountId } from '../commonOpts';
import { validateAccount } from '../validation';
import { Arguments } from 'yargs';

jest.mock('@hubspot/local-dev-lib/config');
jest.mock('@hubspot/local-dev-lib/logger');
jest.mock('@hubspot/local-dev-lib/oauth');
jest.mock('@hubspot/local-dev-lib/personalAccessKey');
jest.mock('../commonOpts');

const yargsOption = (option: { [key: string]: string }): Arguments => ({
  $0: '',
  _: [''],
  ...option,
});

describe('lib/validation', () => {
  describe('validateAccount', () => {
    it('returns false if an account is missing', async () => {
      (getAccountId as jest.Mock).mockReturnValueOnce(null);
      expect(await validateAccount(yargsOption({ account: '123' }))).toBe(
        false
      );
    });
    it('returns false if an account config is missing', async () => {
      (getAccountId as jest.Mock).mockReturnValueOnce('123');
      (getAccountConfig as jest.Mock).mockReturnValueOnce(undefined);
      expect(await validateAccount(yargsOption({ account: '123' }))).toBe(
        false
      );
    });
    it('returns false for oauth2 authType if auth is missing', async () => {
      (getAccountId as jest.Mock).mockReturnValueOnce('123');
      (getAccountConfig as jest.Mock).mockReturnValueOnce({
        accountId: '123',
        authType: 'oauth2',
      });
      expect(await validateAccount(yargsOption({ account: '123' }))).toBe(
        false
      );
    });
    it('returns false if OAuth is missing configuration', async () => {
      (getAccountId as jest.Mock).mockReturnValueOnce('123');
      (getAccountConfig as jest.Mock).mockReturnValueOnce({
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
      (getAccountId as jest.Mock).mockReturnValueOnce('123');
      (getOauthManager as jest.Mock).mockReturnValueOnce({
        accessToken() {
          return null;
        },
      });
      (getAccountConfig as jest.Mock).mockReturnValueOnce({
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
      (getAccountId as jest.Mock).mockReturnValueOnce('123');
      (getOauthManager as jest.Mock).mockReturnValueOnce({
        accessToken() {
          throw new Error('It failed');
        },
      });
      (getAccountConfig as jest.Mock).mockReturnValueOnce({
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
      (getAccountId as jest.Mock).mockReturnValueOnce('123');
      (getOauthManager as jest.Mock).mockReturnValueOnce({
        accessToken() {
          return 'yep';
        },
      });
      (getAccountConfig as jest.Mock).mockReturnValueOnce({
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
      (getAccountId as jest.Mock).mockReturnValueOnce('123');
      (accessTokenForPersonalAccessKey as jest.Mock).mockImplementationOnce(
        () => {
          throw new Error('It failed');
        }
      );
      (getAccountConfig as jest.Mock).mockReturnValueOnce({
        accountId: '123',
        authType: 'personalaccesskey',
        personalAccessKey: 'foo',
      });
      expect(await validateAccount(yargsOption({ account: '123' }))).toBe(
        false
      );
    });
    it('returns true if "personalaccesskey" configured and an access token is received', async () => {
      (getAccountId as jest.Mock).mockReturnValueOnce('123');
      (accessTokenForPersonalAccessKey as jest.Mock).mockImplementationOnce(
        () => {
          return 'secret-stuff';
        }
      );
      (getAccountConfig as jest.Mock).mockReturnValueOnce({
        accountId: '123',
        authType: 'personalaccesskey',
        personalAccessKey: 'foo',
      });
      expect(await validateAccount(yargsOption({ account: '123' }))).toBe(true);
    });
    it('returns true if apiKey is configured and present', async () => {
      (getAccountId as jest.Mock).mockReturnValueOnce('123');
      (getAccountConfig as jest.Mock).mockReturnValueOnce({
        accountId: '123',
        authType: 'apikey',
        apiKey: 'my-secret-key',
      });
      expect(await validateAccount(yargsOption({ account: '123' }))).toBe(true);
    });
  });
});

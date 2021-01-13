const moment = require('moment');
const { getAndLoadConfigIfNeeded, getAccountConfig } = require('../lib/config');
const { fetchAccessToken } = require('../api/localDevAuth/unauthenticated');
const { ENVIRONMENTS } = require('../lib/constants');

const { accessTokenForPersonalAccessKey } = require('../personalAccessKey');

jest.mock('../lib/config');
jest.mock('../logger');
jest.mock('../api/localDevAuth/unauthenticated');

describe('personalAccessKey', () => {
  describe('accessTokenForPersonalAccessKey()', () => {
    it('refreshes access token when access token is missing', async () => {
      const accountId = 123;
      const account = {
        accountId,
        authType: 'personalaccesskey',
        personalAccessKey: 'let-me-in',
      };
      getAndLoadConfigIfNeeded.mockReturnValue({
        accounts: [account],
      });
      getAccountConfig.mockReturnValue(account);

      const freshAccessToken = 'fresh-token';
      fetchAccessToken.mockReturnValue(
        Promise.resolve({
          oauthAccessToken: freshAccessToken,
          expiresAtMillis: moment()
            .add(1, 'hours')
            .valueOf(),
          encodedOAuthRefreshToken: 'let-me-in',
          scopeGroups: ['content'],
          hubId: accountId,
          userId: 456,
        })
      );
      const accessToken = await accessTokenForPersonalAccessKey(accountId);
      expect(accessToken).toEqual(freshAccessToken);
    });
    it('uses accountId when refreshing token', async () => {
      const accountId = 123;
      const account = {
        accountId,
        authType: 'personalaccesskey',
        personalAccessKey: 'let-me-in',
      };
      getAndLoadConfigIfNeeded.mockReturnValue({
        accounts: [account],
      });
      getAccountConfig.mockReturnValue(account);

      await accessTokenForPersonalAccessKey(accountId);
      expect(fetchAccessToken).toHaveBeenCalledWith(
        'let-me-in',
        ENVIRONMENTS.PROD,
        accountId
      );
    });
    it('refreshes access token when the existing token is expired', async () => {
      const accountId = 123;
      const account = {
        accountId,
        authType: 'personalaccesskey',
        personalAccessKey: 'let-me-in',
        auth: {
          tokenInfo: {
            expiresAt: moment()
              .subtract(1, 'hours')
              .toISOString(),
            accessToken: 'test-token',
          },
        },
      };
      getAndLoadConfigIfNeeded.mockReturnValue({
        accounts: [account],
      });
      getAccountConfig.mockReturnValue(account);

      const freshAccessToken = 'fresh-token';
      fetchAccessToken.mockReturnValue(
        Promise.resolve({
          oauthAccessToken: freshAccessToken,
          expiresAtMillis: moment()
            .add(1, 'hours')
            .valueOf(),
          encodedOAuthRefreshToken: 'let-me-in',
          scopeGroups: ['content'],
          hubId: accountId,
          userId: 456,
        })
      );
      const accessToken = await accessTokenForPersonalAccessKey(accountId);
      expect(accessToken).toEqual(freshAccessToken);
    });
    it('refreshes access tokens multiple times', async () => {
      const accountId = 123;
      const accessKey = 'let-me-in';
      const userId = 456;
      const mockAccount = (expiresAt, accessToken) => ({
        accountId,
        authType: 'personalaccesskey',
        personalAccessKey: accessKey,
        auth: {
          tokenInfo: {
            expiresAt,
            accessToken,
          },
        },
      });
      const initialAccountConfig = mockAccount(
        moment()
          .subtract(2, 'hours')
          .toISOString(),
        'test-token'
      );
      getAndLoadConfigIfNeeded.mockReturnValueOnce({
        accounts: [initialAccountConfig],
      });
      getAccountConfig.mockReturnValueOnce(initialAccountConfig);

      const firstAccessToken = 'fresh-token';
      const expiresAtMillis = moment()
        .subtract(1, 'hours')
        .valueOf();

      fetchAccessToken.mockReturnValueOnce(
        Promise.resolve({
          oauthAccessToken: firstAccessToken,
          expiresAtMillis,
          encodedOAuthRefreshToken: accessKey,
          scopeGroups: ['content'],
          hubId: accountId,
          userId,
        })
      );
      const firstRefreshedAccessToken = await accessTokenForPersonalAccessKey(
        accountId
      );
      expect(firstRefreshedAccessToken).toEqual(firstAccessToken);
      const updatedAccountConfig = mockAccount(
        moment(expiresAtMillis).toISOString(),
        firstAccessToken
      );
      getAndLoadConfigIfNeeded.mockReturnValueOnce({
        accounts: [updatedAccountConfig],
      });
      getAccountConfig.mockReturnValueOnce(updatedAccountConfig);

      const secondAccessToken = 'another-fresh-token';
      fetchAccessToken.mockReturnValueOnce(
        Promise.resolve({
          oauthAccessToken: secondAccessToken,
          expiresAtMillis,
          encodedOAuthRefreshToken: accessKey,
          scopeGroups: ['content'],
          hubId: accountId,
          userId,
        })
      );

      const secondRefreshedAccessToken = await accessTokenForPersonalAccessKey(
        accountId
      );
      expect(secondRefreshedAccessToken).toEqual(secondAccessToken);
    });
  });
});

import moment = require('moment');
import { getAndLoadConfigIfNeeded, getPortalConfig } from '../lib/config';
import { fetchAccessToken } from '../api/localDevAuth';
import { accessTokenForPersonalAccessKey } from '../personalAccessKey';

jest.mock('../lib/config');
jest.mock('../logger');
jest.mock('../api/localDevAuth');

const getPortalConfigMock = getPortalConfig as jest.Mock;
const getAndLoadConfigIfNeededMock = getAndLoadConfigIfNeeded as jest.Mock;
const fetchAccessTokenMock = fetchAccessToken as jest.Mock;

describe('personalAccessKey', () => {
  describe('accessTokenForPersonalAccessKey()', () => {
    it('refreshes access token when access token is missing', async () => {
      const portalId = 123;
      const portal = {
        portalId,
        authType: 'personalaccesskey',
        personalAccessKey: 'let-me-in',
      };
      getAndLoadConfigIfNeededMock.mockReturnValue({
        portals: [portal],
      });
      getPortalConfigMock.mockReturnValue(portal);

      const freshAccessToken = 'fresh-token';
      fetchAccessTokenMock.mockReturnValue(
        Promise.resolve({
          oauthAccessToken: freshAccessToken,
          expiresAtMillis: moment()
            .add(1, 'hours')
            .valueOf(),
          encodedOAuthRefreshToken: 'let-me-in',
          scopeGroups: ['content'],
          hubId: portalId,
          userId: 456,
        })
      );
      const accessToken = await accessTokenForPersonalAccessKey(portalId);
      expect(accessToken).toEqual(freshAccessToken);
    });
    it('uses portalId when refreshing token', async () => {
      const portalId = 123;
      const portal = {
        portalId,
        authType: 'personalaccesskey',
        personalAccessKey: 'let-me-in',
      };
      getAndLoadConfigIfNeededMock.mockReturnValue({
        portals: [portal],
      });
      getPortalConfigMock.mockReturnValue(portal);

      await accessTokenForPersonalAccessKey(portalId);
      expect(fetchAccessToken).toHaveBeenCalledWith(
        'let-me-in',
        'PROD',
        portalId
      );
    });
    it('refreshes access token when the existing token is expired', async () => {
      const portalId = 123;
      const portal = {
        portalId,
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
      getAndLoadConfigIfNeededMock.mockReturnValue({
        portals: [portal],
      });
      getPortalConfigMock.mockReturnValue(portal);

      const freshAccessToken = 'fresh-token';
      fetchAccessTokenMock.mockReturnValue(
        Promise.resolve({
          oauthAccessToken: freshAccessToken,
          expiresAtMillis: moment()
            .add(1, 'hours')
            .valueOf(),
          encodedOAuthRefreshToken: 'let-me-in',
          scopeGroups: ['content'],
          hubId: portalId,
          userId: 456,
        })
      );
      const accessToken = await accessTokenForPersonalAccessKey(portalId);
      expect(accessToken).toEqual(freshAccessToken);
    });
    it('refreshes access tokens multiple times', async () => {
      const portalId = 123;
      const accessKey = 'let-me-in';
      const userId = 456;
      const mockPortal = (expiresAt, accessToken) => ({
        portalId,
        authType: 'personalaccesskey',
        personalAccessKey: accessKey,
        auth: {
          tokenInfo: {
            expiresAt,
            accessToken,
          },
        },
      });
      const initialPortalConfig = mockPortal(
        moment()
          .subtract(2, 'hours')
          .toISOString(),
        'test-token'
      );
      getAndLoadConfigIfNeededMock.mockReturnValueOnce({
        portals: [initialPortalConfig],
      });
      getPortalConfigMock.mockReturnValueOnce(initialPortalConfig);

      const firstAccessToken = 'fresh-token';
      const expiresAtMillis = moment()
        .subtract(1, 'hours')
        .valueOf();

      fetchAccessTokenMock.mockReturnValueOnce(
        Promise.resolve({
          oauthAccessToken: firstAccessToken,
          expiresAtMillis,
          encodedOAuthRefreshToken: accessKey,
          scopeGroups: ['content'],
          hubId: portalId,
          userId,
        })
      );
      const firstRefreshedAccessToken = await accessTokenForPersonalAccessKey(
        portalId
      );
      expect(firstRefreshedAccessToken).toEqual(firstAccessToken);
      const updatedPortalConfig = mockPortal(
        moment(expiresAtMillis).toISOString(),
        firstAccessToken
      );
      getAndLoadConfigIfNeededMock.mockReturnValueOnce({
        portals: [updatedPortalConfig],
      });
      getPortalConfigMock.mockReturnValueOnce(updatedPortalConfig);

      const secondAccessToken = 'another-fresh-token';
      fetchAccessTokenMock.mockReturnValueOnce(
        Promise.resolve({
          oauthAccessToken: secondAccessToken,
          expiresAtMillis,
          encodedOAuthRefreshToken: accessKey,
          scopeGroups: ['content'],
          hubId: portalId,
          userId,
        })
      );

      const secondRefreshedAccessToken = await accessTokenForPersonalAccessKey(
        portalId
      );
      expect(secondRefreshedAccessToken).toEqual(secondAccessToken);
    });
  });
});

const moment = require('moment');
const {
  getAndLoadConfigIfNeeded,
  getPortalConfig,
} = require('../../lib/config');
const { fetchAccessToken } = require('../../api/localDevAuth');

const { accessTokenForUserToken } = require('../userToken');

jest.mock('../../lib/config');
jest.mock('../../logger');
jest.mock('../../api/localDevAuth');

describe('userToken', () => {
  describe('accessTokenForUserToken()', () => {
    it('refreshes access token when the existing token is expired', async () => {
      const portalId = 123;
      const portal = {
        portalId,
        authType: 'usertoken',
        userToken: 'let-me-in',
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
        portals: [portal],
      });
      getPortalConfig.mockReturnValue(portal);

      const freshAccessToken = 'fresh-token';
      fetchAccessToken.mockReturnValue(
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
      const accessToken = await accessTokenForUserToken(portalId);
      expect(accessToken).toEqual(freshAccessToken);
    });
  });
});

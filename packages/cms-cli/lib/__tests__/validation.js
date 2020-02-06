const { getPortalConfig } = require('@hubspot/cms-lib');
const { getOauthManager } = require('@hubspot/cms-lib/oauth');
const { accessTokenForUserToken } = require('@hubspot/cms-lib/userToken');

const { getPortalId } = require('../commonOpts');
const { validatePortal } = require('../validation');

jest.mock('@hubspot/cms-lib');
jest.mock('@hubspot/cms-lib/logger');
jest.mock('@hubspot/cms-lib/oauth');
jest.mock('@hubspot/cms-lib/userToken');
jest.mock('../commonOpts');

describe('validation', () => {
  describe('validatePortal', () => {
    it('returns false if a portal is missing', async () => {
      getPortalId.mockReturnValueOnce(null);
      expect(await validatePortal({ portal: 123 })).toBe(false);
    });
    it('returns false if a portal config is missing', async () => {
      getPortalId.mockReturnValueOnce(123);
      getPortalConfig.mockReturnValueOnce(undefined);
      expect(await validatePortal({ portal: 123 })).toBe(false);
    });
    it('returns false if an api key is missing', async () => {
      getPortalId.mockReturnValueOnce(123);
      getPortalConfig.mockReturnValueOnce({
        portalId: 123,
      });
      expect(await validatePortal({ portal: 123 })).toBe(false);
    });
    it('returns false for oauth2 authType if auth is missing', async () => {
      getPortalId.mockReturnValueOnce(123);
      getPortalConfig.mockReturnValueOnce({
        portalId: 123,
        authType: 'oauth2',
      });
      expect(await validatePortal({ portal: 123 })).toBe(false);
    });
    it('returns false if OAuth is missing configuration', async () => {
      getPortalId.mockReturnValueOnce(123);
      getPortalConfig.mockReturnValueOnce({
        portalId: 123,
        authType: 'oauth2',
        auth: {
          clientId: 'foo',
        },
      });
      expect(await validatePortal({ portal: 123 })).toBe(false);
    });
    it('returns false if an access token was not retrieved', async () => {
      getPortalId.mockReturnValueOnce(123);
      getOauthManager.mockReturnValueOnce({
        accessToken() {
          return null;
        },
      });
      getPortalConfig.mockReturnValueOnce({
        portalId: 123,
        authType: 'oauth2',
        auth: {
          clientId: 'foo',
          clientSecret: 'abc',
          tokenInfo: {
            refreshToken: 'def',
          },
        },
      });
      expect(await validatePortal({ portal: 123 })).toBe(false);
    });
    it('returns false if an getting an access token throws', async () => {
      getPortalId.mockReturnValueOnce(123);
      getOauthManager.mockReturnValueOnce({
        accessToken() {
          throw new Error('It failed');
        },
      });
      getPortalConfig.mockReturnValueOnce({
        portalId: 123,
        authType: 'oauth2',
        auth: {
          clientId: 'foo',
          clientSecret: 'abc',
          tokenInfo: {
            refreshToken: 'def',
          },
        },
      });
      expect(await validatePortal({ portal: 123 })).toBe(false);
    });
    it('returns true if OAuth is configured and an access token is received', async () => {
      getPortalId.mockReturnValueOnce(123);
      getOauthManager.mockReturnValueOnce({
        accessToken() {
          return 'yep';
        },
      });
      getPortalConfig.mockReturnValueOnce({
        portalId: 123,
        authType: 'oauth2',
        auth: {
          clientId: 'foo',
          clientSecret: 'abc',
          tokenInfo: {
            refreshToken: 'def',
          },
        },
      });
      expect(await validatePortal({ portal: 123 })).toBe(true);
    });
    it('returns false if "usertoken" configured and getting an access token throws', async () => {
      getPortalId.mockReturnValueOnce(123);
      accessTokenForUserToken.mockImplementationOnce(() => {
        throw new Error('It failed');
      });
      getPortalConfig.mockReturnValueOnce({
        portalId: 123,
        authType: 'usertoken',
        userToken: 'foo',
      });
      expect(await validatePortal({ portal: 123 })).toBe(false);
    });
    it('returns true if "usertoken" configured and an access token is received', async () => {
      getPortalId.mockReturnValueOnce(123);
      accessTokenForUserToken.mockImplementationOnce(() => {
        return 'secret-stuff';
      });
      getPortalConfig.mockReturnValueOnce({
        portalId: 123,
        authType: 'usertoken',
        userToken: 'foo',
      });
      expect(await validatePortal({ portal: 123 })).toBe(true);
    });
    it('returns true if apiKey is configured and present', async () => {
      getPortalId.mockReturnValueOnce(123);
      getPortalConfig.mockReturnValueOnce({
        portalId: 123,
        authType: 'apiKey',
        apiKey: 'my-secret-key',
      });
      expect(await validatePortal({ portal: 123 })).toBe(true);
    });
  });
});

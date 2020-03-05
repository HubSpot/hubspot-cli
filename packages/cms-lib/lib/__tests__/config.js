const fs = require('fs');
const configModule = require('../config');
const {
  setConfig,
  getAndLoadConfigIfNeeded,
  getConfig,
  getPortalId,
  updateDefaultPortal,
  deleteEmptyConfigFile,
} = configModule;
jest.mock('fs');

const API_KEY_CONFIG = {
  name: 'API',
  portalId: 1111,
  authType: 'apikey',
  apiKey: 'secret',
};
const OAUTH2_CONFIG = {
  name: 'OAUTH2',
  portalId: 2222,
  authType: 'oauth2',
  auth: {
    clientId: 'fakeClientId',
    clientSecret: 'fakeClientSecret',
    scopes: ['content'],
    tokenInfo: {
      expiresAt: '2020-01-01T00:00:00.000Z',
      refreshToken: 'fakeOauthRefreshToken',
      accessToken: 'fakeOauthAccessToken',
    },
  },
};
const PERSONAL_ACCESS_KEY_CONFIG = {
  name: 'PERSONALACCESSKEY',
  portalId: 3333,
  authType: 'personalaccesskey',
  auth: {
    scopes: ['content'],
    tokenInfo: {
      expiresAt: '2020-01-01T00:00:00.000Z',
      accessToken: 'fakePersonalAccessKeyAccessToken',
    },
  },
  personalAccessKey: 'fakePersonalAccessKey',
};

describe('lib/config', () => {
  describe('getPortalId()', () => {
    beforeEach(() => {
      setConfig({
        defaultPortal: 'PROD',
        portals: [
          {
            name: 'QA',
            portalId: 123,
            apiKey: 'secret',
          },
          {
            name: 'PROD',
            portalId: 456,
            apiKey: 'secret',
          },
        ],
      });
    });
    it('returns portalId from config when a name is passed', () => {
      expect(getPortalId('QA')).toEqual(123);
    });
    it('returns portalId from config when a string id is passed', () => {
      expect(getPortalId('123')).toEqual(123);
    });
    it('returns portalId from config when a numeric id is passed', () => {
      expect(getPortalId(123)).toEqual(123);
    });
    it('returns defaultPortal from config', () => {
      expect(getPortalId()).toEqual(456);
    });
  });

  describe('updateDefaultPortal()', () => {
    const myPortalName = 'Foo';

    beforeEach(() => {
      updateDefaultPortal(myPortalName);
    });

    it('sets the defaultPortal in the config', () => {
      expect(getConfig().defaultPortal).toEqual(myPortalName);
    });
  });

  describe('deleteEmptyConfigFile()', () => {
    const fs = require('fs-extra');

    it('does not delete config file if there are contents', () => {
      fs.__setReadFile('defaultPortal: Foo');
      fs.__setExistsValue(true);
      fs.unlinkSync = jest.fn();

      deleteEmptyConfigFile();
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('deletes config file if empty', () => {
      fs.__setReadFile('');
      fs.__setExistsValue(true);
      fs.unlinkSync = jest.fn();

      deleteEmptyConfigFile();
      expect(fs.unlinkSync).toHaveBeenCalled();
    });
  });

  describe('getAndLoadConfigIfNeeded)', () => {
    beforeEach(() => {
      setConfig(null);
      process.env = {};
    });

    it('loads a config from file if no combination of environment variables is sufficient', () => {
      const spy = jest.spyOn(configModule, 'getConfigPath');

      getAndLoadConfigIfNeeded();
      expect(configModule.getConfigPath).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    describe('oauth environment variable config', () => {
      const {
        portalId,
        auth: {
          clientId,
          clientSecret,
          tokenInfo: { refreshToken },
        },
      } = OAUTH2_CONFIG;
      let portalConfig;

      beforeEach(() => {
        process.env = {
          HUBSPOT_PORTAL_ID: portalId,
          HUBSPOT_CLIENT_ID: clientId,
          HUBSPOT_CLIENT_SECRET: clientSecret,
          HUBSPOT_REFRESH_TOKEN: refreshToken,
        };
        getAndLoadConfigIfNeeded();
        portalConfig = getConfig().portals[0];
      });

      it('does not load a config from file', () => {
        expect(fs.readFileSync).not.toHaveBeenCalled();
      });

      it('creates a portal config', () => {
        expect(portalConfig).toBeTruthy();
      });

      it('sets the portal as default', () => {
        expect(getConfig().defaultPortal).toEqual(portalConfig.name);
      });

      it('properly loads portal id value', () => {
        expect(portalConfig.portalId).toEqual(portalId);
      });

      it('properly loads client id value', () => {
        expect(portalConfig.auth.clientId).toEqual(clientId);
      });

      it('properly loads client secret value', () => {
        expect(portalConfig.auth.clientSecret).toEqual(clientSecret);
      });

      it('properly loads refresh token value', () => {
        expect(portalConfig.auth.tokenInfo.refreshToken).toEqual(refreshToken);
      });
    });

    describe('apikey environment variable config', () => {
      const { portalId, apiKey } = API_KEY_CONFIG;
      let portalConfig;

      beforeEach(() => {
        process.env = {
          HUBSPOT_PORTAL_ID: portalId,
          HUBSPOT_API_KEY: apiKey,
        };
        getAndLoadConfigIfNeeded();
        portalConfig = getConfig().portals[0];
      });

      it('does not load a config from file', () => {
        expect(fs.readFileSync).not.toHaveBeenCalled();
      });

      it('creates a portal config', () => {
        expect(portalConfig).toBeTruthy();
      });

      it('sets the portal as default', () => {
        expect(getConfig().defaultPortal).toEqual(portalConfig.name);
      });

      it('properly loads portal id value', () => {
        expect(portalConfig.portalId).toEqual(portalId);
      });

      it('properly loads api key value', () => {
        expect(portalConfig.apiKey).toEqual(apiKey);
      });
    });

    describe('personalaccesskey environment variable config', () => {
      const { portalId, personalAccessKey } = PERSONAL_ACCESS_KEY_CONFIG;
      let portalConfig;

      beforeEach(() => {
        process.env = {
          HUBSPOT_PORTAL_ID: portalId,
          HUBSPOT_PERSONAL_ACCESS_KEY: personalAccessKey,
        };
        getAndLoadConfigIfNeeded();
        portalConfig = getConfig().portals[0];
      });

      it('does not load a config from file', () => {
        expect(fs.readFileSync).not.toHaveBeenCalled();
      });

      it('creates a portal config', () => {
        expect(portalConfig).toBeTruthy();
      });

      it('sets the portal as default', () => {
        expect(getConfig().defaultPortal).toEqual(portalConfig.name);
      });

      it('properly loads portal id value', () => {
        expect(portalConfig.portalId).toEqual(portalId);
      });

      it('properly loads personal access key value', () => {
        expect(portalConfig.personalAccessKey).toEqual(personalAccessKey);
      });
    });
  });
});

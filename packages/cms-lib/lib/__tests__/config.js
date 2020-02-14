const {
  setConfig,
  getConfig,
  getPortalId,
  updateDefaultPortal,
  updatePortalConfig,
  deleteEmptyConfigFile,
} = require('../config');
jest.mock('fs');

const API_CONFIG = {
  name: 'API',
  portalId: 1,
  authType: 'apikey',
  apiKey: 'secret',
};
const OAUTH2_CONFIG = {
  name: 'OAUTH2',
  portalId: 2,
  authType: 'oauth2',
  auth: {
    clientId: 'fakeClientId',
    clientSecret: 'fakeClientSecret',
    scopes: ['content'],
    tokenInfo: {
      expiresAt: '2020-01-01T00:00:00.000Z',
      refreshToken: 'fakeRefreshToken',
      accessToken: 'fakeAccessToken',
    },
  },
};
const PERSONAL_ACCESS_KEY_CONFIG = {
  name: 'PERSONALACCESSKEY',
  portalId: 3,
  authType: 'personalaccesskey',
  auth: {
    scopes: ['content'],
    tokenInfo: {
      expiresAt: '2020-01-01T00:00:00.000Z',
      accessToken: 'fakeAccessToken',
    },
    personalAccessKey: 'fakePersonalAccessKey',
  },
};
const PORTALS = [API_CONFIG, OAUTH2_CONFIG, PERSONAL_ACCESS_KEY_CONFIG];

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

  describe('updatePortalConfig()', () => {
    const CONFIG = {
      defaultPortal: PORTALS[0].name,
      portals: PORTALS,
    };

    beforeEach(() => {
      setConfig(CONFIG);
    });

    it('sets the config properly', () => {
      expect(getConfig()).toEqual(CONFIG);
    });

    PORTALS.forEach(portalConfig => {
      describe(`authType ${portalConfig.authType}`, () => {
        it('does not modify the config if nothing is passed', () => {
          const result = updatePortalConfig(portalConfig);
          Object.keys(portalConfig).forEach(prop => {
            expect(result[prop]).toEqual(portalConfig[prop]);
          });
        });
      });
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
    const fs = require('fs');

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
});

const {
  setConfig,
  getConfig,
  getPortalId,
  updateDefaultPortal,
  updatePortalConfig,
  deleteEmptyConfigFile,
} = require('../config');
jest.mock('fs');

const API_KEY_CONFIG = {
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
      refreshToken: 'fakeOauthRefreshToken',
      accessToken: 'fakeOauthAccessToken',
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
      accessToken: 'fakePersonalAccessKeyAccessToken',
    },
  },
  personalAccessKey: 'fakePersonalAccessKey',
};
const PORTALS = [API_KEY_CONFIG, OAUTH2_CONFIG, PERSONAL_ACCESS_KEY_CONFIG];

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

    it('throws an error if invalid authType is passed', () => {
      const callingUpdatePortalConfigWithInvalidAuthType = () => {
        return updatePortalConfig({
          portalId: 123,
          authType: 'invalidAuthType',
        });
      };
      expect(callingUpdatePortalConfigWithInvalidAuthType).toThrow();
    });

    describe('authType apikey', () => {
      const portalConfig = API_KEY_CONFIG;

      it('does not modify the config if no changes are passed', () => {
        updatePortalConfig(portalConfig);
        const result = getConfig().portals.filter(
          portal => portal.portalId === portalConfig.portalId
        )[0];
        Object.keys(portalConfig).forEach(prop => {
          expect(result[prop]).toEqual(portalConfig[prop]);
        });
      });

      xit('throws an error if no api key is passed', () => {
        const callingUpdatePortalConfigWithNoApiKey = () => {
          // setConfig({
          //   portals: [],
          // });
          return updatePortalConfig({
            ...API_KEY_CONFIG,
            apiKey: undefined,
          });
        };
        expect(callingUpdatePortalConfigWithNoApiKey).toThrow();
      });
    });

    describe('authType oauth2', () => {
      const portalConfig = OAUTH2_CONFIG;

      it('does not modify the config if no changes are passed', () => {
        updatePortalConfig(portalConfig);
        const result = getConfig().portals.filter(
          portal => portal.portalId === portalConfig.portalId
        )[0];
        Object.keys(portalConfig).forEach(prop => {
          expect(result[prop]).toEqual(portalConfig[prop]);
        });
      });

      xit('throws an error if no auth data is passed', () => {
        const callingUpdatePortalConfigWithNoAuthData = () => {
          return updatePortalConfig({
            ...OAUTH2_CONFIG,
            auth: undefined,
          });
        };
        expect(callingUpdatePortalConfigWithNoAuthData).toThrow();
      });
    });

    describe('authType personalaccesskey', () => {
      const portalConfig = PERSONAL_ACCESS_KEY_CONFIG;

      it('does not modify the config if no changes are passed', () => {
        updatePortalConfig(portalConfig);
        const result = getConfig().portals.filter(
          portal => portal.portalId === portalConfig.portalId
        )[0];
        Object.keys(portalConfig).forEach(prop => {
          expect(result[prop]).toEqual(portalConfig[prop]);
        });
      });

      xit('throws an error if no auth data is passed', () => {
        const callingUpdatePortalConfigWithNoAuthData = () => {
          return updatePortalConfig({
            ...PERSONAL_ACCESS_KEY_CONFIG,
            auth: undefined,
          });
        };
        expect(callingUpdatePortalConfigWithNoAuthData).toThrow();
      });

      describe('overwriting oauth', () => {
        let resultingConfig;
        beforeEach(() => {
          resultingConfig = updatePortalConfig({
            ...PERSONAL_ACCESS_KEY_CONFIG,
            portalId: OAUTH2_CONFIG.portalId,
          });
        });

        it('sets the required property values correctly', () => {
          const requiredPropertyValues = ['authType', 'name', 'auth'];
          requiredPropertyValues.forEach(prop => {
            expect(resultingConfig[prop]).toEqual(
              PERSONAL_ACCESS_KEY_CONFIG[prop]
            );
          });
        });

        it('removed unnecessary property values', () => {
          expect(resultingConfig.auth.tokenInfo.refreshToken).toBeFalsy();
        });
      });

      describe('overwriting apikey', () => {
        let resultingConfig;
        beforeEach(() => {
          resultingConfig = updatePortalConfig({
            ...PERSONAL_ACCESS_KEY_CONFIG,
            portalId: API_KEY_CONFIG.portalId,
          });
        });

        it('sets the required property values correctly', () => {
          const requiredPropertyValues = ['authType', 'name', 'auth'];
          requiredPropertyValues.forEach(prop => {
            expect(resultingConfig[prop]).toEqual(
              PERSONAL_ACCESS_KEY_CONFIG[prop]
            );
          });
        });

        it('removed unnecessary property values', () => {
          expect(resultingConfig.apiKey).toBeFalsy();
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

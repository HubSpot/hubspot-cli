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
const PORTALS = [API_KEY_CONFIG, OAUTH2_CONFIG, PERSONAL_ACCESS_KEY_CONFIG];

const getPortalByAuthType = (config, authType) => {
  return config.portals.filter(portal => portal.authType === authType)[0];
};

describe('lib/config', () => {
  describe('setConfig()', () => {
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
  });

  describe('getPortalId()', () => {
    beforeEach(() => {
      setConfig({
        defaultPortal: PERSONAL_ACCESS_KEY_CONFIG.name,
        portals: PORTALS,
      });
    });
    it('returns portalId from config when a name is passed', () => {
      expect(getPortalId(API_KEY_CONFIG.name)).toEqual(API_KEY_CONFIG.portalId);
    });
    it('returns portalId from config when a string id is passed', () => {
      expect(getPortalId(API_KEY_CONFIG.portalId.toString())).toEqual(
        API_KEY_CONFIG.portalId
      );
    });
    it('returns portalId from config when a numeric id is passed', () => {
      expect(getPortalId(API_KEY_CONFIG.portalId)).toEqual(
        API_KEY_CONFIG.portalId
      );
    });
    it('returns defaultPortal from config', () => {
      expect(getPortalId()).toEqual(PERSONAL_ACCESS_KEY_CONFIG.portalId);
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

    it('throws an error if invalid authType is passed', () => {
      const callingUpdatePortalConfigWithInvalidAuthType = () => {
        return updatePortalConfig({
          portalId: 123,
          authType: 'invalidAuthType',
        });
      };
      expect(callingUpdatePortalConfigWithInvalidAuthType).toThrow();
    });

    it('does not add the env to the config if not specified or existing', () => {
      const modifiedPersonalAccessKeyConfig = {
        ...PERSONAL_ACCESS_KEY_CONFIG,
      };
      delete modifiedPersonalAccessKeyConfig.env;
      updatePortalConfig(modifiedPersonalAccessKeyConfig);

      expect(getConfig().env).toBeFalsy();
    });

    it('sets the env in the config if specified', () => {
      const env = 'QA';
      const modifiedPersonalAccessKeyConfig = {
        ...PERSONAL_ACCESS_KEY_CONFIG,
        env: env,
      };
      updatePortalConfig(modifiedPersonalAccessKeyConfig);

      expect(
        getPortalByAuthType(
          getConfig(),
          modifiedPersonalAccessKeyConfig.authType
        ).env
      ).toEqual(env);
    });

    it('sets the env in the config if it was preexisting', () => {
      const env = 'QA';
      setConfig({
        defaultPortal: PERSONAL_ACCESS_KEY_CONFIG.name,
        portals: [{ ...PERSONAL_ACCESS_KEY_CONFIG, env }],
      });
      const modifiedPersonalAccessKeyConfig = {
        ...PERSONAL_ACCESS_KEY_CONFIG,
      };
      delete modifiedPersonalAccessKeyConfig.env;
      updatePortalConfig(modifiedPersonalAccessKeyConfig);

      expect(
        getPortalByAuthType(
          getConfig(),
          modifiedPersonalAccessKeyConfig.authType
        ).env
      ).toEqual(env);
    });

    it('overwrites the existing env in the config if specified', () => {
      const previousEnv = 'QA';
      const newEnv = 'PROD';
      setConfig({
        defaultPortal: PERSONAL_ACCESS_KEY_CONFIG.name,
        portals: [{ ...PERSONAL_ACCESS_KEY_CONFIG, env: previousEnv }],
      });
      const modifiedPersonalAccessKeyConfig = {
        ...PERSONAL_ACCESS_KEY_CONFIG,
        env: newEnv,
      };
      updatePortalConfig(modifiedPersonalAccessKeyConfig);

      expect(
        getPortalByAuthType(
          getConfig(),
          modifiedPersonalAccessKeyConfig.authType
        ).env
      ).toEqual(newEnv);
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

      it('throws an error if no api key is passed', () => {
        const callingUpdatePortalConfigWithNoApiKey = () => {
          setConfig({});
          const modifiedApiKeyConfig = {
            ...API_KEY_CONFIG,
          };
          delete modifiedApiKeyConfig.apiKey;
          return updatePortalConfig(modifiedApiKeyConfig);
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

      it('throws an error if no auth data is passed', () => {
        const callingUpdatePortalConfigWithNoAuthData = () => {
          setConfig({});
          const modifiedOauth2Config = {
            ...OAUTH2_CONFIG,
          };
          delete modifiedOauth2Config.auth;
          return updatePortalConfig(modifiedOauth2Config);
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

      it('throws an error if no auth data is passed', () => {
        const callingUpdatePortalConfigWithNoAuthData = () => {
          setConfig({});
          const modifiedPersonalAccessKeyConfig = {
            ...PERSONAL_ACCESS_KEY_CONFIG,
          };
          delete modifiedPersonalAccessKeyConfig.auth;
          return updatePortalConfig(modifiedPersonalAccessKeyConfig);
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

        it('sets the authType', () => {
          expect(resultingConfig.authType).toEqual(
            PERSONAL_ACCESS_KEY_CONFIG.authType
          );
        });

        it('sets the personalAccessKey', () => {
          expect(resultingConfig.personalAccessKey).toEqual(
            PERSONAL_ACCESS_KEY_CONFIG.personalAccessKey
          );
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

        it('sets the authType', () => {
          expect(resultingConfig.authType).toEqual(
            PERSONAL_ACCESS_KEY_CONFIG.authType
          );
        });

        it('sets the personalAccessKey', () => {
          expect(resultingConfig.personalAccessKey).toEqual(
            PERSONAL_ACCESS_KEY_CONFIG.personalAccessKey
          );
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

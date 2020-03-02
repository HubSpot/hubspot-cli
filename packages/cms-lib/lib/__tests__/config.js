const {
  deleteEmptyConfigFile,
  getConfig,
  getPortalId,
  setConfig,
  updateDefaultPortal,
  updatePortalConfig,
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
      expect(getPortalId(OAUTH2_CONFIG.name)).toEqual(OAUTH2_CONFIG.portalId);
    });
    it('returns portalId from config when a string id is passed', () => {
      expect(getPortalId(OAUTH2_CONFIG.portalId.toString())).toEqual(
        OAUTH2_CONFIG.portalId
      );
    });
    it('returns portalId from config when a numeric id is passed', () => {
      expect(getPortalId(OAUTH2_CONFIG.portalId)).toEqual(
        OAUTH2_CONFIG.portalId
      );
    });
    it('returns defaultPortal from config', () => {
      expect(getPortalId()).toEqual(PERSONAL_ACCESS_KEY_CONFIG.portalId);
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

  describe('updatePortalConfig()', () => {
    const CONFIG = {
      defaultPortal: PORTALS[0].name,
      portals: PORTALS,
    };

    beforeEach(() => {
      setConfig(CONFIG);
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
      const environment = 'QA';
      const modifiedPersonalAccessKeyConfig = {
        ...PERSONAL_ACCESS_KEY_CONFIG,
        environment,
      };
      updatePortalConfig(modifiedPersonalAccessKeyConfig);

      expect(
        getPortalByAuthType(
          getConfig(),
          modifiedPersonalAccessKeyConfig.authType
        ).env
      ).toEqual(environment);
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
      const previousEnv = 'PROD';
      const newEnv = 'QA';
      setConfig({
        defaultPortal: PERSONAL_ACCESS_KEY_CONFIG.name,
        portals: [{ ...PERSONAL_ACCESS_KEY_CONFIG, env: previousEnv }],
      });
      const modifiedPersonalAccessKeyConfig = {
        ...PERSONAL_ACCESS_KEY_CONFIG,
        environment: newEnv,
      };
      updatePortalConfig(modifiedPersonalAccessKeyConfig);

      expect(
        getPortalByAuthType(
          getConfig(),
          modifiedPersonalAccessKeyConfig.authType
        ).env
      ).toEqual(newEnv);
    });

    it('does not add the name to the config if not specified or existing', () => {
      const modifiedPersonalAccessKeyConfig = {
        ...PERSONAL_ACCESS_KEY_CONFIG,
      };
      delete modifiedPersonalAccessKeyConfig.name;
      updatePortalConfig(modifiedPersonalAccessKeyConfig);

      expect(getConfig().name).toBeFalsy();
    });

    it('sets the name in the config if specified', () => {
      const name = 'MYNAME';
      const modifiedPersonalAccessKeyConfig = {
        ...PERSONAL_ACCESS_KEY_CONFIG,
        name,
      };
      updatePortalConfig(modifiedPersonalAccessKeyConfig);

      expect(
        getPortalByAuthType(
          getConfig(),
          modifiedPersonalAccessKeyConfig.authType
        ).name
      ).toEqual(name);
    });

    it('sets the env in the config if it was preexisting', () => {
      const name = 'PREEXISTING';
      setConfig({
        defaultPortal: PERSONAL_ACCESS_KEY_CONFIG.name,
        portals: [{ ...PERSONAL_ACCESS_KEY_CONFIG, name }],
      });
      const modifiedPersonalAccessKeyConfig = {
        ...PERSONAL_ACCESS_KEY_CONFIG,
      };
      delete modifiedPersonalAccessKeyConfig.name;
      updatePortalConfig(modifiedPersonalAccessKeyConfig);

      expect(
        getPortalByAuthType(
          getConfig(),
          modifiedPersonalAccessKeyConfig.authType
        ).name
      ).toEqual(name);
    });

    it('overwrites the existing env in the config if specified', () => {
      const previousName = 'PREVIOUSNAME';
      const newName = 'NEWNAME';
      setConfig({
        defaultPortal: PERSONAL_ACCESS_KEY_CONFIG.name,
        portals: [{ ...PERSONAL_ACCESS_KEY_CONFIG, env: previousName }],
      });
      const modifiedPersonalAccessKeyConfig = {
        ...PERSONAL_ACCESS_KEY_CONFIG,
        name: newName,
      };
      updatePortalConfig(modifiedPersonalAccessKeyConfig);

      expect(
        getPortalByAuthType(
          getConfig(),
          modifiedPersonalAccessKeyConfig.authType
        ).name
      ).toEqual(newName);
    });
  });
});

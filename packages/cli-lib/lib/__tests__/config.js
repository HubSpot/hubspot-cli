const {
  setConfig,
  getAndLoadConfigIfNeeded,
  getConfig,
  getAccountConfig,
  getAccountId,
  updateDefaultAccount,
  updateAccountConfig,
  validateConfig,
  deleteEmptyConfigFile,
  configFilenameIsIgnoredByGitignore,
  setConfigPath,
} = require('../config');
const { ENVIRONMENTS } = require('../constants');
jest.mock('findup-sync', () => {
  return jest.fn(() => `/Users/fakeuser/hubspot.config.yml`);
});

const API_KEY_CONFIG = {
  portalId: 1111,
  name: 'API',
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

const getAccountByAuthType = (config, authType) => {
  return config.portals.filter(portal => portal.authType === authType)[0];
};

describe('lib/config', () => {
  describe('setConfig method', () => {
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

  describe('getAccountId method', () => {
    beforeEach(() => {
      process.env = {};
      setConfig({
        defaultPortal: PERSONAL_ACCESS_KEY_CONFIG.name,
        portals: PORTALS,
      });
    });
    it('returns portalId from config when a name is passed', () => {
      expect(getAccountId(OAUTH2_CONFIG.name)).toEqual(OAUTH2_CONFIG.portalId);
    });
    it('returns portalId from config when a string id is passed', () => {
      expect(getAccountId(OAUTH2_CONFIG.portalId.toString())).toEqual(
        OAUTH2_CONFIG.portalId
      );
    });
    it('returns portalId from config when a numeric id is passed', () => {
      expect(getAccountId(OAUTH2_CONFIG.portalId)).toEqual(
        OAUTH2_CONFIG.portalId
      );
    });
    it('returns defaultPortal from config', () => {
      expect(getAccountId()).toEqual(PERSONAL_ACCESS_KEY_CONFIG.portalId);
    });
  });

  describe('updateDefaultAccount method', () => {
    const myPortalName = 'Foo';

    beforeEach(() => {
      updateDefaultAccount(myPortalName);
    });

    it('sets the defaultPortal in the config', () => {
      expect(getConfig().defaultPortal).toEqual(myPortalName);
    });
  });

  describe('deleteEmptyConfigFile method', () => {
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

  describe('updateAccountConfig method', () => {
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
      updateAccountConfig(modifiedPersonalAccessKeyConfig);

      expect(getConfig().env).toBeFalsy();
    });

    it('sets the env in the config if specified', () => {
      const environment = ENVIRONMENTS.QA;
      const modifiedPersonalAccessKeyConfig = {
        ...PERSONAL_ACCESS_KEY_CONFIG,
        environment,
      };
      updateAccountConfig(modifiedPersonalAccessKeyConfig);

      expect(
        getAccountByAuthType(
          getConfig(),
          modifiedPersonalAccessKeyConfig.authType
        ).env
      ).toEqual(environment);
    });

    it('sets the env in the config if it was preexisting', () => {
      const env = ENVIRONMENTS.QA;
      setConfig({
        defaultPortal: PERSONAL_ACCESS_KEY_CONFIG.name,
        portals: [{ ...PERSONAL_ACCESS_KEY_CONFIG, env }],
      });
      const modifiedPersonalAccessKeyConfig = {
        ...PERSONAL_ACCESS_KEY_CONFIG,
      };
      delete modifiedPersonalAccessKeyConfig.env;
      updateAccountConfig(modifiedPersonalAccessKeyConfig);

      expect(
        getAccountByAuthType(
          getConfig(),
          modifiedPersonalAccessKeyConfig.authType
        ).env
      ).toEqual(env);
    });

    it('overwrites the existing env in the config if specified', () => {
      const previousEnv = ENVIRONMENTS.PROD;
      const newEnv = ENVIRONMENTS.QA;
      setConfig({
        defaultPortal: PERSONAL_ACCESS_KEY_CONFIG.name,
        portals: [{ ...PERSONAL_ACCESS_KEY_CONFIG, env: previousEnv }],
      });
      const modifiedPersonalAccessKeyConfig = {
        ...PERSONAL_ACCESS_KEY_CONFIG,
        environment: newEnv,
      };
      updateAccountConfig(modifiedPersonalAccessKeyConfig);

      expect(
        getAccountByAuthType(
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
      updateAccountConfig(modifiedPersonalAccessKeyConfig);

      expect(getConfig().name).toBeFalsy();
    });

    it('sets the name in the config if specified', () => {
      const name = 'MYNAME';
      const modifiedPersonalAccessKeyConfig = {
        ...PERSONAL_ACCESS_KEY_CONFIG,
        name,
      };
      updateAccountConfig(modifiedPersonalAccessKeyConfig);

      expect(
        getAccountByAuthType(
          getConfig(),
          modifiedPersonalAccessKeyConfig.authType
        ).name
      ).toEqual(name);
    });

    it('sets the name in the config if it was preexisting', () => {
      const name = 'PREEXISTING';
      setConfig({
        defaultPortal: PERSONAL_ACCESS_KEY_CONFIG.name,
        portals: [{ ...PERSONAL_ACCESS_KEY_CONFIG, name }],
      });
      const modifiedPersonalAccessKeyConfig = {
        ...PERSONAL_ACCESS_KEY_CONFIG,
      };
      delete modifiedPersonalAccessKeyConfig.name;
      updateAccountConfig(modifiedPersonalAccessKeyConfig);

      expect(
        getAccountByAuthType(
          getConfig(),
          modifiedPersonalAccessKeyConfig.authType
        ).name
      ).toEqual(name);
    });

    it('overwrites the existing name in the config if specified', () => {
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
      updateAccountConfig(modifiedPersonalAccessKeyConfig);

      expect(
        getAccountByAuthType(
          getConfig(),
          modifiedPersonalAccessKeyConfig.authType
        ).name
      ).toEqual(newName);
    });
  });

  describe('validateConfig method', () => {
    const DEFAULT_PORTAL = PORTALS[0].name;

    it('allows valid config', () => {
      setConfig({
        defaultPortal: DEFAULT_PORTAL,
        portals: PORTALS,
      });
      expect(validateConfig()).toEqual(true);
    });

    it('does not allow duplicate portalIds', () => {
      setConfig({
        defaultPortal: DEFAULT_PORTAL,
        portals: [...PORTALS, PORTALS[0]],
      });
      expect(validateConfig()).toEqual(false);
    });

    it('does not allow duplicate names', () => {
      setConfig({
        defaultPortal: DEFAULT_PORTAL,
        portals: [
          ...PORTALS,
          {
            ...PORTALS[0],
            portalId: 123456789,
          },
        ],
      });
      expect(validateConfig()).toEqual(false);
    });

    it('does not allow names with spaces', () => {
      setConfig({
        defaultPortal: DEFAULT_PORTAL,
        portals: [
          {
            ...PORTALS[0],
            name: 'A NAME WITH SPACES',
          },
        ],
      });
      expect(validateConfig()).toEqual(false);
    });

    it('allows multiple portals with no name', () => {
      setConfig({
        defaultPortal: DEFAULT_PORTAL,
        portals: [
          {
            ...PORTALS[0],
            name: null,
          },
          {
            ...PORTALS[1],
            name: null,
          },
        ],
      });
      expect(validateConfig()).toEqual(true);
    });
  });

  describe('getAndLoadConfigIfNeeded method', () => {
    const fs = require('fs-extra');

    beforeEach(() => {
      setConfig(null);
      process.env = {};
    });

    it('loads a config from file if no combination of environment variables is sufficient', () => {
      const readFileSyncSpy = jest.spyOn(fs, 'readFileSync');

      getAndLoadConfigIfNeeded();
      expect(fs.readFileSync).toHaveBeenCalled();
      readFileSyncSpy.mockReset();
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
        getAndLoadConfigIfNeeded({ useEnv: true });
        portalConfig = getAccountConfig(portalId);
      });

      it('does not load a config from file', () => {
        expect(fs.readFileSync).not.toHaveBeenCalled();
      });

      it('creates a portal config', () => {
        expect(portalConfig).toBeTruthy();
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
        getAndLoadConfigIfNeeded({ useEnv: true });
        portalConfig = getAccountConfig(portalId);
      });

      it('does not load a config from file', () => {
        expect(fs.readFileSync).not.toHaveBeenCalled();
      });

      it('creates a portal config', () => {
        expect(portalConfig).toBeTruthy();
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
        getAndLoadConfigIfNeeded({ useEnv: true });
        portalConfig = getAccountConfig(portalId);
      });

      it('does not load a config from file', () => {
        expect(fs.readFileSync).not.toHaveBeenCalled();
      });

      it('creates a portal config', () => {
        expect(portalConfig).toBeTruthy();
      });

      it('properly loads portal id value', () => {
        expect(portalConfig.portalId).toEqual(portalId);
      });

      it('properly loads personal access key value', () => {
        expect(portalConfig.personalAccessKey).toEqual(personalAccessKey);
      });
    });
  });

  describe('configFilenameIsIgnoredByGitignore method', () => {
    const fs = require('fs-extra');

    it('returns false if the config file is not ignored', () => {
      const gitignoreContent = '';
      setConfigPath(`/Users/fakeuser/someproject/hubspot.config.yml`);
      jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
        return Buffer.from(gitignoreContent);
      });

      expect(
        configFilenameIsIgnoredByGitignore([
          '/Users/fakeuser/someproject/.gitignore',
        ])
      ).toBe(false);
    });

    it('identifies if a config file is ignored with a specific ignore statement', () => {
      const gitignoreContent = 'hubspot.config.yml';
      setConfigPath(`/Users/fakeuser/someproject/hubspot.config.yml`);
      const readFileSyncSpy = jest
        .spyOn(fs, 'readFileSync')
        .mockImplementation(() => {
          return Buffer.from(gitignoreContent);
        });

      expect(
        configFilenameIsIgnoredByGitignore([
          '/Users/fakeuser/someproject/.gitignore',
        ])
      ).toBe(true);
      readFileSyncSpy.mockReset();
    });

    it('identifies if a config file is ignored with a wildcard statement', () => {
      const gitignoreContent = 'hubspot.config.*';
      setConfigPath(`/Users/fakeuser/someproject/hubspot.config.yml`);
      const readFileSyncSpy = jest
        .spyOn(fs, 'readFileSync')
        .mockImplementation(() => {
          return Buffer.from(gitignoreContent);
        });

      expect(
        configFilenameIsIgnoredByGitignore([
          '/Users/fakeuser/someproject/.gitignore',
        ])
      ).toBe(true);
      readFileSyncSpy.mockReset();
    });

    it('identifies if a non-standard named config file is not ignored', () => {
      const gitignoreContent = 'hubspot.config.yml';
      setConfigPath(`/Users/fakeuser/someproject/config/my.custom.name.yml`);
      const readFileSyncSpy = jest
        .spyOn(fs, 'readFileSync')
        .mockImplementation(() => {
          return Buffer.from(gitignoreContent);
        });

      expect(
        configFilenameIsIgnoredByGitignore([
          '/Users/fakeuser/someproject/.gitignore',
        ])
      ).toBe(false);
      readFileSyncSpy.mockReset();
    });

    it('identifies if a non-standard named config file is ignored', () => {
      const gitignoreContent = 'my.custom.name.yml';
      setConfigPath(`/Users/fakeuser/someproject/config/my.custom.name.yml`);
      const readFileSyncSpy = jest
        .spyOn(fs, 'readFileSync')
        .mockImplementation(() => {
          return Buffer.from(gitignoreContent);
        });

      expect(
        configFilenameIsIgnoredByGitignore([
          '/Users/fakeuser/someproject/.gitignore',
        ])
      ).toBe(true);
      readFileSyncSpy.mockReset();
    });
  });
});

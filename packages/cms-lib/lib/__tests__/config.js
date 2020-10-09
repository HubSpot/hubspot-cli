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
  name: 'API',
  accountId: 1111,
  authType: 'apikey',
  apiKey: 'secret',
};
const OAUTH2_CONFIG = {
  name: 'OAUTH2',
  accountId: 2222,
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
  accountId: 3333,
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

const ACCOUNTS = [API_KEY_CONFIG, OAUTH2_CONFIG, PERSONAL_ACCESS_KEY_CONFIG];

const getAccountByAuthType = (config, authType) => {
  return config.accounts.filter(account => account.authType === authType)[0];
};

describe('lib/config', () => {
  describe('setConfig method', () => {
    const CONFIG = {
      defaultAccount: ACCOUNTS[0].name,
      accounts: ACCOUNTS,
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
        defaultAccount: PERSONAL_ACCESS_KEY_CONFIG.name,
        accounts: ACCOUNTS,
      });
    });
    it('returns accountId from config when a name is passed', () => {
      expect(getAccountId(OAUTH2_CONFIG.name)).toEqual(OAUTH2_CONFIG.accountId);
    });
    it('returns accountId from config when a string id is passed', () => {
      expect(getAccountId(OAUTH2_CONFIG.accountId.toString())).toEqual(
        OAUTH2_CONFIG.accountId
      );
    });
    it('returns accountId from config when a numeric id is passed', () => {
      expect(getAccountId(OAUTH2_CONFIG.accountId)).toEqual(
        OAUTH2_CONFIG.accountId
      );
    });
    it('returns defaultAccount from config', () => {
      expect(getAccountId()).toEqual(PERSONAL_ACCESS_KEY_CONFIG.accountId);
    });
  });

  describe('updateDefaultAccount method', () => {
    const myAccountName = 'Foo';

    beforeEach(() => {
      updateDefaultAccount(myAccountName);
    });

    it('sets the defaultAccount in the config', () => {
      expect(getConfig().defaultAccount).toEqual(myAccountName);
    });
  });

  describe('deleteEmptyConfigFile method', () => {
    const fs = require('fs-extra');

    it('does not delete config file if there are contents', () => {
      fs.__setReadFile('defaultAccount: Foo');
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
      defaultAccount: ACCOUNTS[0].name,
      accounts: ACCOUNTS,
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
        defaultAccount: PERSONAL_ACCESS_KEY_CONFIG.name,
        accounts: [{ ...PERSONAL_ACCESS_KEY_CONFIG, env }],
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
        defaultAccount: PERSONAL_ACCESS_KEY_CONFIG.name,
        accounts: [{ ...PERSONAL_ACCESS_KEY_CONFIG, env: previousEnv }],
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
        defaultAccount: PERSONAL_ACCESS_KEY_CONFIG.name,
        accounts: [{ ...PERSONAL_ACCESS_KEY_CONFIG, name }],
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
        defaultAccount: PERSONAL_ACCESS_KEY_CONFIG.name,
        accounts: [{ ...PERSONAL_ACCESS_KEY_CONFIG, env: previousName }],
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
    const DEFAULT_PORTAL = ACCOUNTS[0].name;

    it('allows valid config', () => {
      setConfig({
        defaultAccount: DEFAULT_PORTAL,
        accounts: ACCOUNTS,
      });
      expect(validateConfig()).toEqual(true);
    });

    it('does not allow duplicate accountIds', () => {
      setConfig({
        defaultAccount: DEFAULT_PORTAL,
        accounts: [...ACCOUNTS, ACCOUNTS[0]],
      });
      expect(validateConfig()).toEqual(false);
    });

    it('does not allow duplicate names', () => {
      setConfig({
        defaultAccount: DEFAULT_PORTAL,
        accounts: [
          ...ACCOUNTS,
          {
            ...ACCOUNTS[0],
            accountId: 123456789,
          },
        ],
      });
      expect(validateConfig()).toEqual(false);
    });

    it('does not allow names with spaces', () => {
      setConfig({
        defaultAccount: DEFAULT_PORTAL,
        accounts: [
          {
            ...ACCOUNTS[0],
            name: 'A NAME WITH SPACES',
          },
        ],
      });
      expect(validateConfig()).toEqual(false);
    });

    it('allows multiple accounts with no name', () => {
      setConfig({
        defaultAccount: DEFAULT_PORTAL,
        accounts: [
          {
            ...ACCOUNTS[0],
            name: null,
          },
          {
            ...ACCOUNTS[1],
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
        accountId,
        auth: {
          clientId,
          clientSecret,
          tokenInfo: { refreshToken },
        },
      } = OAUTH2_CONFIG;
      let accountConfig;

      beforeEach(() => {
        process.env = {
          HUBSPOT_PORTAL_ID: accountId,
          HUBSPOT_CLIENT_ID: clientId,
          HUBSPOT_CLIENT_SECRET: clientSecret,
          HUBSPOT_REFRESH_TOKEN: refreshToken,
        };
        getAndLoadConfigIfNeeded({ useEnv: true });
        accountConfig = getAccountConfig(accountId);
      });

      it('does not load a config from file', () => {
        expect(fs.readFileSync).not.toHaveBeenCalled();
      });

      it('creates a account config', () => {
        expect(accountConfig).toBeTruthy();
      });

      it('properly loads account id value', () => {
        expect(accountConfig.accountId).toEqual(accountId);
      });

      it('properly loads client id value', () => {
        expect(accountConfig.auth.clientId).toEqual(clientId);
      });

      it('properly loads client secret value', () => {
        expect(accountConfig.auth.clientSecret).toEqual(clientSecret);
      });

      it('properly loads refresh token value', () => {
        expect(accountConfig.auth.tokenInfo.refreshToken).toEqual(refreshToken);
      });
    });

    describe('apikey environment variable config', () => {
      const { accountId, apiKey } = API_KEY_CONFIG;
      let accountConfig;

      beforeEach(() => {
        process.env = {
          HUBSPOT_PORTAL_ID: accountId,
          HUBSPOT_API_KEY: apiKey,
        };
        getAndLoadConfigIfNeeded({ useEnv: true });
        accountConfig = getAccountConfig(accountId);
      });

      it('does not load a config from file', () => {
        expect(fs.readFileSync).not.toHaveBeenCalled();
      });

      it('creates a account config', () => {
        expect(accountConfig).toBeTruthy();
      });

      it('properly loads account id value', () => {
        expect(accountConfig.accountId).toEqual(accountId);
      });

      it('properly loads api key value', () => {
        expect(accountConfig.apiKey).toEqual(apiKey);
      });
    });

    describe('personalaccesskey environment variable config', () => {
      const { accountId, personalAccessKey } = PERSONAL_ACCESS_KEY_CONFIG;
      let accountConfig;

      beforeEach(() => {
        process.env = {
          HUBSPOT_PORTAL_ID: accountId,
          HUBSPOT_PERSONAL_ACCESS_KEY: personalAccessKey,
        };
        getAndLoadConfigIfNeeded({ useEnv: true });
        accountConfig = getAccountConfig(accountId);
      });

      it('does not load a config from file', () => {
        expect(fs.readFileSync).not.toHaveBeenCalled();
      });

      it('creates a account config', () => {
        expect(accountConfig).toBeTruthy();
      });

      it('properly loads account id value', () => {
        expect(accountConfig.accountId).toEqual(accountId);
      });

      it('properly loads personal access key value', () => {
        expect(accountConfig.personalAccessKey).toEqual(personalAccessKey);
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

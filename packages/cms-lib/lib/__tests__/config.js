const {
  setConfig,
  getAndLoadConfigIfNeeded,
  getOrderedAccount,
  getConfig,
  getConfigAccounts,
  getConfigDefaultAccount,
  getConfigAccountId,
  getAccountConfig,
  getAccountId,
  getOrderedConfig,
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

const LEGACY_API_KEY_CONFIG = (() => {
  const legacyObj = { ...API_KEY_CONFIG };
  legacyObj.portalId = legacyObj.accountId + 1;
  delete legacyObj.accountId;
  return legacyObj;
})();

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

const LEGACY_OAUTH2_CONFIG = (() => {
  const legacyObj = { ...OAUTH2_CONFIG };
  legacyObj.portalId = legacyObj.accountId + 1;
  delete legacyObj.accountId;
  return legacyObj;
})();

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

const LEGACY_PERSONAL_ACCESS_KEY_CONFIG = (() => {
  const legacyObj = { ...PERSONAL_ACCESS_KEY_CONFIG };
  legacyObj.portalId = legacyObj.accountId + 1;
  delete legacyObj.accountId;
  return legacyObj;
})();

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

  describe('legacy accounts (portals)', () => {
    const LEGACY_ACCOUNTS = [
      LEGACY_API_KEY_CONFIG,
      LEGACY_OAUTH2_CONFIG,
      LEGACY_PERSONAL_ACCESS_KEY_CONFIG,
    ];

    const COMBINED_ACCOUNTS = [
      Object.assign({}, API_KEY_CONFIG, LEGACY_API_KEY_CONFIG),
      Object.assign({}, OAUTH2_CONFIG, LEGACY_OAUTH2_CONFIG),
      Object.assign(
        {},
        PERSONAL_ACCESS_KEY_CONFIG,
        LEGACY_PERSONAL_ACCESS_KEY_CONFIG
      ),
    ];

    describe('getConfigAccounts', () => {
      it('supports legacy configs', () => {
        expect(
          getConfigAccounts({ portals: [{ portalId: 'foo' }] })[0].portalId
        ).toEqual('foo');
      });

      it('supports combined configs, and favors accounts over portals', () => {
        const config = {
          portals: [{ portalId: 'foo' }],
          accounts: [{ accountId: 'bar' }],
        };
        expect(getConfigAccounts(config)[0].portalId).toBeUndefined();
        expect(getConfigAccounts(config)[0].accountId).toEqual('bar');
      });
    });

    describe('getConfigDefaultAccount', () => {
      it('supports legacy configs', () => {
        expect(
          getConfigDefaultAccount({
            defaultPortal: 'fooPortal',
          })
        ).toEqual('fooPortal');
      });

      it('supports combined configs, and favors accounts over portals', () => {
        expect(
          getConfigDefaultAccount({
            defaultPortal: 'fooPortal',
            defaultAccount: 'fooAccount',
          })
        ).toEqual('fooAccount');
      });
    });

    describe('getConfigAccountId', () => {
      it('supports legacy configs', () => {
        expect(
          getConfigAccountId({
            portalId: 'fooPortal',
          })
        ).toEqual('fooPortal');
      });

      it('supports combined configs, and favors accounts over portals', () => {
        expect(
          getConfigAccountId({
            portalId: 'fooPortal',
            accountId: 'fooAccount',
          })
        ).toEqual('fooAccount');
      });
    });

    describe('getOrderedAccount', () => {
      it('supports legacy portalId', () => {
        expect(
          getOrderedAccount({
            portalId: '123',
            name: 'this should go before',
          })
        ).toMatchInlineSnapshot(`
          Object {
            "authType": undefined,
            "env": undefined,
            "name": "this should go before",
            "portalId": "123",
          }
        `);
      });

      it('supports combined configs', () => {
        expect(
          getOrderedAccount({
            portalId: '123',
            accountId: '123',
            name: 'this should go before',
          })
        ).toMatchInlineSnapshot(`
          Object {
            "accountId": "123",
            "authType": undefined,
            "env": undefined,
            "name": "this should go before",
            "portalId": "123",
          }
        `);
      });
    });

    describe('getOrderedConfig', () => {
      it('supports legacy portal', () => {
        expect(
          getOrderedConfig({
            defaultPortal: LEGACY_PERSONAL_ACCESS_KEY_CONFIG.portalId,
            accounts: [LEGACY_PERSONAL_ACCESS_KEY_CONFIG],
          })
        ).toMatchInlineSnapshot(`
          Object {
            "accounts": Array [
              Object {
                "auth": Object {
                  "scopes": Array [
                    "content",
                  ],
                  "tokenInfo": Object {
                    "accessToken": "fakePersonalAccessKeyAccessToken",
                    "expiresAt": "2020-01-01T00:00:00.000Z",
                  },
                },
                "authType": "personalaccesskey",
                "env": undefined,
                "name": "PERSONALACCESSKEY",
                "personalAccessKey": "fakePersonalAccessKey",
                "portalId": 3334,
              },
            ],
            "allowsUsageTracking": undefined,
            "defaultMode": undefined,
            "defaultPortal": 3334,
            "httpTimeout": undefined,
          }
        `);
      });

      it('supports combined', () => {
        expect(
          getOrderedConfig({
            defaultAccount: PERSONAL_ACCESS_KEY_CONFIG.accountId,
            defaultPortal: LEGACY_PERSONAL_ACCESS_KEY_CONFIG.portalId,
            accounts: [
              Object.assign(
                {},
                PERSONAL_ACCESS_KEY_CONFIG,
                LEGACY_PERSONAL_ACCESS_KEY_CONFIG
              ),
            ],
          })
        ).toMatchInlineSnapshot(`
          Object {
            "accounts": Array [
              Object {
                "accountId": 3333,
                "auth": Object {
                  "scopes": Array [
                    "content",
                  ],
                  "tokenInfo": Object {
                    "accessToken": "fakePersonalAccessKeyAccessToken",
                    "expiresAt": "2020-01-01T00:00:00.000Z",
                  },
                },
                "authType": "personalaccesskey",
                "env": undefined,
                "name": "PERSONALACCESSKEY",
                "personalAccessKey": "fakePersonalAccessKey",
                "portalId": 3334,
              },
            ],
            "allowsUsageTracking": undefined,
            "defaultAccount": 3333,
            "defaultMode": undefined,
            "defaultPortal": 3334,
            "httpTimeout": undefined,
          }
        `);
      });
    });

    describe('getAccountConfig', () => {
      describe('portalId', () => {
        beforeEach(() => {
          const CONFIG = {
            portals: LEGACY_ACCOUNTS,
          };

          setConfig(CONFIG);
        });

        it('supports portalId', () => {
          expect(getAccountConfig(2222)).toMatchInlineSnapshot(`undefined`);
        });
      });

      describe('combined', () => {
        beforeEach(() => {
          const CONFIG = {
            portals: COMBINED_ACCOUNTS,
          };

          setConfig(CONFIG);
        });

        it('favors account over portal', () => {
          expect(getAccountConfig(2222)).toMatchInlineSnapshot(`
            Object {
              "accountId": 2222,
              "auth": Object {
                "clientId": "fakeClientId",
                "clientSecret": "fakeClientSecret",
                "scopes": Array [
                  "content",
                ],
                "tokenInfo": Object {
                  "accessToken": "fakeOauthAccessToken",
                  "expiresAt": "2020-01-01T00:00:00.000Z",
                  "refreshToken": "fakeOauthRefreshToken",
                },
              },
              "authType": "oauth2",
              "name": "OAUTH2",
            }
          `);
        });
      });
    });

    describe('getAccountId', () => {
      describe('portalId', () => {
        beforeEach(() => {
          const CONFIG = {
            portals: LEGACY_ACCOUNTS,
          };

          setConfig(CONFIG);
        });

        it('supports portalId', () => {
          expect(getAccountId(LEGACY_API_KEY_CONFIG.name)).toEqual(
            LEGACY_API_KEY_CONFIG.portalId
          );
        });
      });

      describe('combination', () => {
        beforeEach(() => {
          const CONFIG = {
            portals: COMBINED_ACCOUNTS,
          };

          setConfig(CONFIG);
        });

        it('favors account over portal', () => {
          expect(getAccountId(COMBINED_ACCOUNTS[0].name)).toEqual(
            COMBINED_ACCOUNTS[0].accountId
          );
        });
      });
    });

    describe('updateAccountConfig', () => {
      describe('portalId', () => {
        beforeEach(() => {
          const CONFIG = {
            portals: LEGACY_ACCOUNTS,
          };

          setConfig(CONFIG);
        });

        it('supports portalId', () => {
          expect(
            updateAccountConfig(
              Object.assign({}, LEGACY_API_KEY_CONFIG, { portalId: 999 })
            )
          ).toMatchInlineSnapshot(`
            Object {
              "apiKey": "secret",
              "auth": undefined,
              "authType": "apikey",
              "defaultMode": undefined,
              "env": undefined,
              "name": "API",
              "personalAccessKey": undefined,
              "portalId": 999,
            }
          `);
        });
      });

      describe('combination', () => {
        beforeEach(() => {
          const CONFIG = {
            portals: LEGACY_ACCOUNTS,
          };

          setConfig(CONFIG);
        });

        it('supports combination, adds both', () => {
          expect(
            updateAccountConfig(
              Object.assign({}, COMBINED_ACCOUNTS[0], { portalId: 999 })
            )
          ).toMatchInlineSnapshot(`
            Object {
              "accountId": 1111,
              "apiKey": "secret",
              "auth": undefined,
              "authType": "apikey",
              "defaultMode": undefined,
              "env": undefined,
              "name": "API",
              "personalAccessKey": undefined,
              "portalId": 999,
            }
          `);
        });
      });
    });

    describe('updateDefaultAccount', () => {
      describe('legacy', () => {
        beforeEach(() => {
          const CONFIG = {
            defaultPortal: 9999,
            portals: LEGACY_ACCOUNTS,
          };

          setConfig(CONFIG);
        });

        it('supports defaultPortal', () => {
          updateDefaultAccount(LEGACY_ACCOUNTS[0].portalId);
          expect(getConfigDefaultAccount()).toEqual(
            LEGACY_ACCOUNTS[0].portalId
          );
        });
      });
    });

    describe('getConfigVariablesFromEnv', () => {
      describe('legacy', () => {
        beforeEach(() => {
          const CONFIG = {
            defaultAccount: 8888,
            defaultPortal: 9999,
            portals: COMBINED_ACCOUNTS,
          };

          setConfig(CONFIG);
        });

        it('supports defaultAccount', () => {
          updateDefaultAccount(LEGACY_ACCOUNTS[0].portalId);
          expect(getConfig().defaultAccount).toEqual(
            LEGACY_ACCOUNTS[0].portalId
          );
        });
      });
    });
  });
});

const {
  setConfig,
  getAndLoadConfigIfNeeded,
  getConfig,
  getPortalConfig,
  getPortalId,
  updateDefaultPortal,
  deleteEmptyConfigFile,
  configFilenameIsIgnoredByGitignore,
  setConfigPath,
} = require('../config');

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
  describe('getPortalId method', () => {
    beforeEach(() => {
      process.env = {};
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

  describe('updateDefaultPortal method', () => {
    const myPortalName = 'Foo';

    beforeEach(() => {
      updateDefaultPortal(myPortalName);
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
        getAndLoadConfigIfNeeded();
        portalConfig = getPortalConfig(portalId);
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
        getAndLoadConfigIfNeeded();
        portalConfig = getPortalConfig(portalId);
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
        getAndLoadConfigIfNeeded();
        portalConfig = getPortalConfig(portalId);
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
          'Users/fakeuser/someproject/.gitignore',
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
          'Users/fakeuser/someproject/.gitignore',
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
          'Users/fakeuser/someproject/.gitignore',
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
          'Users/fakeuser/someproject/.gitignore',
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
          'Users/fakeuser/someproject/.gitignore',
        ])
      ).toBe(true);
      readFileSyncSpy.mockReset();
    });
  });
});

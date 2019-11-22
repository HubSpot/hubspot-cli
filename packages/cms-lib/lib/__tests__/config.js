const {
  loadConfig,
  setConfig,
  getConfig,
  getPortalId,
  getConfigPath,
  writeNewPortalApiKeyConfig,
} = require('../config');
const { getCwd } = require('../../path');

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

  describe('writeNewPortalApiKeyConfig()', () => {
    const configOptions = {
      name: 'MYPORTAL',
      portalId: 123,
      apiKey: 'secret',
    };

    beforeEach(() => {
      writeNewPortalApiKeyConfig(configOptions);
    });

    it('sets the configPath to current working directory', () => {
      expect(getConfigPath()).toContain(getCwd());
    });
    it('sets the config properties using the options passed', () => {
      const defaultPortalConfig = getConfig().portals[0];
      Object.keys(configOptions).forEach(prop => {
        expect(defaultPortalConfig[prop]).toEqual(configOptions[prop]);
      });
    });
    it('generates a config file', () => {
      expect(loadConfig).not.toThrow();
    });
  });
});

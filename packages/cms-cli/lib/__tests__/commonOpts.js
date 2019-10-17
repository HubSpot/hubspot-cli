const {
  Mode,
  DEFAULT_MODE,
  getAndLoadConfigIfNeeded,
  getPortalId,
  getPortalConfig,
} = require('@hubspot/cms-lib');
const { getMode } = require('../commonOpts');

jest.mock('@hubspot/cms-lib');

describe('@hubspot/cms-cli/lib/commonOpts', () => {
  describe('getMode()', () => {
    const portals = {
      PROD: 123,
      DEV: 456,
    };
    const devPortalConfig = {
      portalId: portals.DEV,
      name: 'DEV',
      defaultMode: Mode.draft,
    };
    const prodPortalConfig = {
      portalId: portals.PROD,
      name: 'PROD',
    };
    const config = {
      defaultPortal: 'DEV',
      portals: [devPortalConfig, prodPortalConfig],
    };
    const configWithDefaultMode = {
      ...config,
      defaultMode: Mode.draft,
    };
    afterEach(() => {
      getAndLoadConfigIfNeeded.mockReset();
      getPortalId.mockReset();
      getPortalConfig.mockReset();
    });
    describe('mode option precedence', () => {
      describe('1. --mode', () => {
        it('should return the mode specified by the command option if present.', () => {
          getAndLoadConfigIfNeeded.mockReturnValue(configWithDefaultMode);
          getPortalConfig.mockReturnValue(devPortalConfig);
          expect(getMode({ mode: Mode.draft })).toBe(Mode.draft);
          expect(getMode({ mode: Mode.publish })).toBe(Mode.publish);
          expect(getMode({ mode: 'undefined-mode' })).toBe('undefined-mode');
        });
      });
      describe('2. hubspot.config.yml -> config.portals[x].defaultMode', () => {
        it('should return the defaultMode specified by the portal specific config if present.', () => {
          getAndLoadConfigIfNeeded.mockReturnValue(configWithDefaultMode);
          getPortalId.mockReturnValue(portals.DEV);
          getPortalConfig.mockReturnValue(devPortalConfig);
          expect(getMode({ portal: portals.DEV })).toBe(Mode.draft);
        });
      });
      describe('3. hubspot.config.yml -> config.defaultMode', () => {
        it('should return the defaultMode specified by the config if present.', () => {
          getAndLoadConfigIfNeeded.mockReturnValue(configWithDefaultMode);
          getPortalId.mockReturnValue(portals.PROD);
          getPortalConfig.mockReturnValue(prodPortalConfig);
          expect(getMode({ portal: portals.PROD })).toBe(Mode.draft);
        });
      });
      describe('4. DEFAULT_MODE', () => {
        it('should return the defaultMode specified by the config if present.', () => {
          expect(getMode({ portal: 'xxxxx' })).toBe(DEFAULT_MODE);
        });
      });
    });
  });
});

// @ts-nocheck
const {
  CMS_PUBLISH_MODE,
  DEFAULT_CMS_PUBLISH_MODE,
} = require('@hubspot/local-dev-lib/constants/files');
const {
  getAndLoadConfigIfNeeded,
  getAccountId,
  getAccountConfig,
  loadConfigFromEnvironment,
} = require('@hubspot/local-dev-lib/config');
const { getCmsPublishMode } = require('../commonOpts');

jest.mock('@hubspot/local-dev-lib/config');
jest.mock('@hubspot/local-dev-lib/logger');

describe('lib/commonOpts', () => {
  describe('getCmsPublishMode()', () => {
    const accounts = {
      PROD: 123,
      DEV: 456,
    };
    const devAccountConfig = {
      accountId: accounts.DEV,
      name: 'DEV',
      defaultCmsPublishMode: CMS_PUBLISH_MODE.draft,
    };
    const prodAccountConfig = {
      accountId: accounts.PROD,
      name: 'PROD',
    };
    const config = {
      defaultAccount: 'DEV',
      accounts: [devAccountConfig, prodAccountConfig],
    };
    const configWithDefaultCmsPublishMode = {
      ...config,
      defaultCmsPublishMode: MODE.draft,
    };

    afterEach(() => {
      getAndLoadConfigIfNeeded.mockReset();
      getAccountId.mockReset();
      getAccountConfig.mockReset();
      loadConfigFromEnvironment.mockReset();
    });

    describe('cms publish mode option precedence', () => {
      describe('1. --cmsPublishMode', () => {
        it('should return the cms publish mode specified by the command option if present.', () => {
          getAndLoadConfigIfNeeded.mockReturnValue(configWithDefaultMode);
          getAccountConfig.mockReturnValue(devAccountConfig);
          expect(getMode({ cmsPublishMode: CMS_PUBLISH_MODE.draft })).toBe(
            CMS_PUBLISH_MODE.draft
          );
          expect(getMode({ cmsPublishMode: CMS_PUBLISH_MODE.publish })).toBe(
            CMS_PUBLISH_MODE.publish
          );
          expect(getMode({ cmsPublishMode: 'undefined-mode' })).toBe(
            'undefined-mode'
          );
        });
      });
      describe('2. hubspot.config.yml -> config.accounts[x].defaultCmsPublishMode', () => {
        it('should return the defaultCmsPublishMode specified by the account specific config if present.', () => {
          getAndLoadConfigIfNeeded.mockReturnValue(
            configWithDefaultCmsPublishMode
          );
          getAccountId.mockReturnValue(accounts.DEV);
          getAccountConfig.mockReturnValue(devAccountConfig);
          loadConfigFromEnvironment.mockReturnValue(undefined);
          expect(getCmsPublishMode({ account: accounts.DEV })).toBe(
            CMS_PUBLISH_MODE.draft
          );
        });
      });
      describe('3. hubspot.config.yml -> config.defaultCmsPublishMode', () => {
        it('should return the defaultCmsPublishMode specified by the config if present.', () => {
          getAndLoadConfigIfNeeded.mockReturnValue(
            configWithDefaultCmsPublishMode
          );
          getAccountId.mockReturnValue(accounts.PROD);
          getAccountConfig.mockReturnValue(prodAccountConfig);
          loadConfigFromEnvironment.mockReturnValue(undefined);
          expect(getCmsPublishMode({ account: accounts.PROD })).toBe(
            CMS_PUBLISH_MODE.draft
          );
        });
      });
      describe('4. DEFAULT_CMS_PUBLISH_MODE', () => {
        it('should return the defaultCmsPubishMode specified by the config if present.', () => {
          loadConfigFromEnvironment.mockReturnValue(undefined);
          expect(getCmsPublishMode({ account: 'xxxxx' })).toBe(
            DEFAULT_CMS_PUBLISH_MODE
          );
        });
      });
    });
  });
});

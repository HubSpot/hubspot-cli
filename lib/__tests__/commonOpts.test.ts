import {
  CMS_PUBLISH_MODE,
  DEFAULT_CMS_PUBLISH_MODE,
} from '@hubspot/local-dev-lib/constants/files';
import {
  getAndLoadConfigIfNeeded,
  getAccountId,
  getAccountConfig,
  loadConfigFromEnvironment,
} from '@hubspot/local-dev-lib/config';
import { getCmsPublishMode } from '../commonOpts';
import { CmsPublishMode } from '@hubspot/local-dev-lib/types/Files';
import { Arguments } from 'yargs';

type CmsPublishModeArgs = {
  cmsPublishMode?: CmsPublishMode;
  account?: number | string;
};

function buildArguments(
  args: CmsPublishModeArgs
): Arguments<CmsPublishModeArgs> {
  return {
    _: [],
    $0: '',
    ...args,
  };
}

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
      defaultCmsPublishMode: CMS_PUBLISH_MODE.draft,
    };

    afterEach(() => {
      jest.resetAllMocks();
    });

    describe('cms publish mode option precedence', () => {
      describe('1. --cmsPublishMode', () => {
        it('should return the cms publish mode specified by the command option if present.', () => {
          (getAndLoadConfigIfNeeded as jest.Mock).mockReturnValue(
            configWithDefaultCmsPublishMode
          );
          (getAccountConfig as jest.Mock).mockReturnValue(devAccountConfig);
          expect(
            getCmsPublishMode(
              buildArguments({
                cmsPublishMode: CMS_PUBLISH_MODE.draft,
              })
            )
          ).toBe(CMS_PUBLISH_MODE.draft);
          expect(
            getCmsPublishMode(
              buildArguments({
                cmsPublishMode: CMS_PUBLISH_MODE.publish,
              })
            )
          ).toBe(CMS_PUBLISH_MODE.publish);
        });
      });
      describe('2. hubspot.config.yml -> config.accounts[x].defaultCmsPublishMode', () => {
        it('should return the defaultCmsPublishMode specified by the account specific config if present.', () => {
          (getAndLoadConfigIfNeeded as jest.Mock).mockReturnValue(
            configWithDefaultCmsPublishMode
          );
          (getAccountId as jest.Mock).mockReturnValue(accounts.DEV);
          (getAccountConfig as jest.Mock).mockReturnValue(devAccountConfig);
          (loadConfigFromEnvironment as jest.Mock).mockReturnValue(undefined);
          expect(
            getCmsPublishMode(
              buildArguments({
                account: accounts.DEV,
              })
            )
          ).toBe(CMS_PUBLISH_MODE.draft);
        });
      });
      describe('3. hubspot.config.yml -> config.defaultCmsPublishMode', () => {
        it('should return the defaultCmsPublishMode specified by the config if present.', () => {
          (getAndLoadConfigIfNeeded as jest.Mock).mockReturnValue(
            configWithDefaultCmsPublishMode
          );
          (getAccountId as jest.Mock).mockReturnValue(accounts.PROD);
          (getAccountConfig as jest.Mock).mockReturnValue(prodAccountConfig);
          (loadConfigFromEnvironment as jest.Mock).mockReturnValue(undefined);
          expect(
            getCmsPublishMode(
              buildArguments({
                account: accounts.PROD,
              })
            )
          ).toBe(CMS_PUBLISH_MODE.draft);
        });
      });
      describe('4. DEFAULT_CMS_PUBLISH_MODE', () => {
        it('should return the defaultCmsPubishMode specified by the config if present.', () => {
          (loadConfigFromEnvironment as jest.Mock).mockReturnValue(undefined);
          expect(
            getCmsPublishMode(
              buildArguments({
                account: 'xxxxx',
              })
            )
          ).toBe(DEFAULT_CMS_PUBLISH_MODE);
        });
      });
    });
  });
});

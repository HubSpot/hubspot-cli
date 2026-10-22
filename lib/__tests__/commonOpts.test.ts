import {
  CMS_PUBLISH_MODE,
  DEFAULT_CMS_PUBLISH_MODE,
} from '@hubspot/local-dev-lib/constants/files';
import { getConfig, getConfigAccountById } from '@hubspot/local-dev-lib/config';
import { addCustomHelpOutput, getCmsPublishMode } from '../commonOpts.js';
import { uiLogger } from '../ui/logger.js';
import { lib } from '../../lang/en.js';
import { CmsPublishMode } from '@hubspot/local-dev-lib/types/Files';
import yargs, { Arguments } from 'yargs';
import { Mock } from 'vitest';

const mockedGetConfigAccountById = getConfigAccountById as Mock;
const mockedGetConfig = getConfig as Mock;

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

vi.mock('@hubspot/local-dev-lib/config');
vi.unmock('yargs');

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
      vi.resetAllMocks();
    });

    describe('cms publish mode option precedence', () => {
      describe('1. --cmsPublishMode', () => {
        it('should return the cms publish mode specified by the command option if present.', () => {
          mockedGetConfig.mockReturnValue(configWithDefaultCmsPublishMode);
          mockedGetConfigAccountById.mockReturnValue(devAccountConfig);
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
          mockedGetConfig.mockReturnValue(configWithDefaultCmsPublishMode);
          mockedGetConfigAccountById.mockReturnValue(devAccountConfig);
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
          mockedGetConfig.mockReturnValue(configWithDefaultCmsPublishMode);
          mockedGetConfigAccountById.mockReturnValue(prodAccountConfig);
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

  describe('addCustomHelpOutput()', () => {
    const originalArgv = process.argv;
    const processExitSpy = vi.spyOn(process, 'exit');
    const yargsWithHelp = yargs([]).option('json', { type: 'boolean' });

    beforeEach(() => {
      processExitSpy.mockImplementation(() => {
        throw new Error('process.exit');
      });
    });

    afterEach(() => {
      process.argv = originalArgv;
    });

    it('should add the agent sections when --agent-help is passed', async () => {
      process.argv = [
        'node',
        'hs',
        'project',
        'upload',
        '--agent-help',
        '--help',
      ];

      await addCustomHelpOutput(yargsWithHelp, 'upload', 'Upload a project');

      const output = vi.mocked(uiLogger.log).mock.calls[0][0];
      expect(output).toContain('--json');
      expect(output).toContain(lib.agentHelp.jsonOutput.noSchema);
      expect(output).toContain(lib.agentHelp.exitCodes);
      expect(processExitSpy).toHaveBeenCalled();
    });

    it('should not add the agent sections to --help', async () => {
      process.argv = ['node', 'hs', 'project', 'upload', '--help'];

      await addCustomHelpOutput(yargsWithHelp, 'upload', 'Upload a project');

      expect(vi.mocked(uiLogger.log).mock.calls[0][0]).not.toContain(
        lib.agentHelp.exitCodes
      );
    });
  });
});

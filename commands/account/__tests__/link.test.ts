import { ArgumentsCamelCase } from 'yargs';
import * as configLib from '@hubspot/local-dev-lib/config';
import * as hsSettingsLib from '@hubspot/local-dev-lib/config/hsSettings';
import * as defaultAccountOverrideLib from '@hubspot/local-dev-lib/config/defaultAccountOverride';
import * as gitignoreLib from '@hubspot/local-dev-lib/gitignore';
import * as pathLib from '@hubspot/local-dev-lib/path';
import * as renderLinkedAccountsTableLib from '../../../lib/link/renderLinkedAccountsTable.js';
import * as errorHandlersLib from '../../../lib/errorHandlers/index.js';
import * as usageTrackingLib from '../../../lib/usageTracking.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import { commands } from '../../../lang/en.js';
import { LinkArgs } from '../../../types/Link.js';

const { mockHandleLinkFlow } = vi.hoisted(() => ({
  mockHandleLinkFlow: vi.fn(),
}));

vi.mock('@hubspot/local-dev-lib/config');
vi.mock('@hubspot/local-dev-lib/config/hsSettings');
vi.mock('@hubspot/local-dev-lib/config/defaultAccountOverride');
vi.mock('@hubspot/local-dev-lib/gitignore');
vi.mock('@hubspot/local-dev-lib/path', () => ({
  getCwd: vi.fn().mockReturnValue('/test/project'),
}));
vi.mock('../../../lib/link/index.js', () => ({
  handleLinkFlow: mockHandleLinkFlow,
}));
vi.mock('../../../lib/link/renderLinkedAccountsTable.js');
vi.mock('../../../lib/errorHandlers/index.js');
vi.mock('../../../lib/commonOpts');
vi.mock('../../../lib/ui/index.js');

import linkCommand from '../link.js';

const localConfigFileExistsSpy = vi.spyOn(configLib, 'localConfigFileExists');
const getAllConfigAccountsSpy = vi.spyOn(configLib, 'getAllConfigAccounts');
const getHsSettingsFileSpy = vi.spyOn(
  hsSettingsLib,
  'getHsSettingsFileIfExists'
);
const getHsSettingsFilePathSpy = vi.spyOn(
  hsSettingsLib,
  'getHsSettingsFilePath'
);
const writeHsSettingsFileSpy = vi.spyOn(hsSettingsLib, 'writeHsSettingsFile');
const getDefaultAccountOverrideAccountIdSpy = vi.spyOn(
  defaultAccountOverrideLib,
  'getDefaultAccountOverrideAccountId'
);
const checkAndAddSettingsToGitignoreSpy = vi.spyOn(
  gitignoreLib,
  'checkAndAddHsFolderToGitignore'
);
const getCwdSpy = vi.spyOn(pathLib, 'getCwd');
const renderLinkedAccountsTableSpy = vi.spyOn(
  renderLinkedAccountsTableLib,
  'renderLinkedAccountsTable'
);
const debugErrorSpy = vi.spyOn(errorHandlersLib, 'debugError');
const trackCommandUsageSpy = vi.spyOn(usageTrackingLib, 'trackCommandUsage');
const processExitSpy = vi.spyOn(process, 'exit');

describe('commands/account/link', () => {
  let args: ArgumentsCamelCase<LinkArgs>;

  beforeEach(() => {
    localConfigFileExistsSpy.mockReturnValue(false);
    getAllConfigAccountsSpy.mockReturnValue([]);
    getHsSettingsFileSpy.mockReturnValue(null);
    getHsSettingsFilePathSpy.mockReturnValue('/test/.hs/settings.json');
    writeHsSettingsFileSpy.mockImplementation(() => {});
    getDefaultAccountOverrideAccountIdSpy.mockReturnValue(null);
    checkAndAddSettingsToGitignoreSpy.mockImplementation(() => {});
    getCwdSpy.mockReturnValue('/test/project');
    renderLinkedAccountsTableSpy.mockResolvedValue(undefined);
    debugErrorSpy.mockImplementation(() => {});
    trackCommandUsageSpy.mockImplementation(async () => {});
    mockHandleLinkFlow.mockResolvedValue({ status: 'noop' });
    // @ts-expect-error Mock implementation
    processExitSpy.mockImplementation(() => {});

    args = {
      derivedAccountId: 123,
      d: false,
      debug: false,
      addUsageMetadata: vi.fn(),
      exit: vi.fn(),
      _: ['account', 'link'],
      $0: '',
    } as ArgumentsCamelCase<LinkArgs>;
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(linkCommand.command).toEqual('link');
    });
  });

  describe('describe', () => {
    // TODO: uncomment these tests (and remove the one below it) after we unhide the link command
    // it('should provide a description', () => {
    //   expect(linkCommand.describe).toBeDefined();
    //   expect(linkCommand.describe).toEqual(
    //     commands.account.subcommands.link.describe
    //   );
    // });

    it('should not provide a description', () => {
      expect(linkCommand.describe).not.toBeDefined();
      expect(linkCommand.describe).not.toEqual(
        commands.account.subcommands.link.describe
      );
    });
  });

  describe('handler', () => {
    it('should exit ERROR when localConfigFileExists returns true', async () => {
      localConfigFileExistsSpy.mockReturnValue(true);

      await linkCommand.handler(args);

      expect(uiLogger.error).toHaveBeenCalledWith(
        commands.account.subcommands.link.shared.deprecatedConfigNotSupported(
          'hs account link'
        )
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should log linking directory message for new file', async () => {
      getHsSettingsFileSpy.mockReturnValue(null);

      await linkCommand.handler(args);

      expect(uiLogger.log).toHaveBeenCalledWith(
        commands.account.subcommands.link.linkingDirectory('/test/project')
      );
    });

    it('should log managing linked accounts message for existing file', async () => {
      const settings = {
        accounts: [111],
        localDefaultAccount: 111,
      };
      getHsSettingsFileSpy.mockReturnValue(settings);

      await linkCommand.handler(args);

      expect(uiLogger.log).toHaveBeenCalledWith(
        commands.account.subcommands.link.managingLinkedAccounts(
          '/test/project'
        )
      );
    });

    it('should call renderLinkedAccountsTable for existing file with accounts', async () => {
      const settings = {
        accounts: [111],
        localDefaultAccount: 111,
      };
      getHsSettingsFileSpy.mockReturnValue(settings);

      await linkCommand.handler(args);

      expect(renderLinkedAccountsTableSpy).toHaveBeenCalledWith(settings);
    });

    it('should not call renderLinkedAccountsTable when accounts list is empty', async () => {
      const settings = {
        accounts: [],
        localDefaultAccount: undefined,
      };
      getHsSettingsFileSpy.mockReturnValue(settings);

      await linkCommand.handler(args);

      expect(renderLinkedAccountsTableSpy).not.toHaveBeenCalled();
    });

    it('should call handleLinkFlow with correct params', async () => {
      getHsSettingsFileSpy.mockReturnValue(null);
      getDefaultAccountOverrideAccountIdSpy.mockReturnValue(null);

      await linkCommand.handler(args);

      expect(mockHandleLinkFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: {
            localDefaultAccount: undefined,
            accounts: [],
          },
          accountOverrideId: null,
          args,
        })
      );
    });

    it('should write settings and call checkAndAddHsFolderToGitignore on ok:true', async () => {
      const newSettings = {
        accounts: [111],
        localDefaultAccount: 111,
      };
      mockHandleLinkFlow.mockResolvedValue({
        status: 'success',
        settings: newSettings,
      });

      await linkCommand.handler(args);

      expect(writeHsSettingsFileSpy).toHaveBeenCalledWith(newSettings);
      expect(checkAndAddSettingsToGitignoreSpy).toHaveBeenCalledWith(
        '/test/.hs/settings.json'
      );
    });

    it('should log created message for new file success', async () => {
      getHsSettingsFileSpy.mockReturnValue(null);
      mockHandleLinkFlow.mockResolvedValue({
        status: 'success',
        settings: { accounts: [111], localDefaultAccount: 111 },
      });

      await linkCommand.handler(args);

      expect(uiLogger.success).toHaveBeenCalledWith(
        commands.account.subcommands.link.success.created(
          '/test/.hs/settings.json'
        )
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should log saved message for existing file success', async () => {
      getHsSettingsFileSpy.mockReturnValue({
        accounts: [111],
        localDefaultAccount: 111,
      });
      mockHandleLinkFlow.mockResolvedValue({
        status: 'success',
        settings: { accounts: [111, 222], localDefaultAccount: 111 },
      });

      await linkCommand.handler(args);

      expect(uiLogger.success).toHaveBeenCalledWith(
        commands.account.subcommands.link.shared.savedToSettings(
          '/test/.hs/settings.json'
        )
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should exit error on status:error', async () => {
      mockHandleLinkFlow.mockResolvedValue({
        status: 'error',
        reason: 'Something went wrong',
      });

      await linkCommand.handler(args);

      expect(uiLogger.error).toHaveBeenCalledWith('Something went wrong');
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should exit success on ok:noop', async () => {
      mockHandleLinkFlow.mockResolvedValue({ status: 'noop' });

      await linkCommand.handler(args);

      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should exit error when writeHsSettingsFile throws', async () => {
      mockHandleLinkFlow.mockResolvedValue({
        status: 'success',
        settings: { accounts: [111], localDefaultAccount: 111 },
      });
      writeHsSettingsFileSpy.mockImplementation(() => {
        throw new Error('disk full');
      });

      await linkCommand.handler(args);

      expect(uiLogger.error).toHaveBeenCalledWith(
        commands.account.subcommands.link.shared.writeSettingsFailed(
          '/test/.hs/settings.json',
          new Error('disk full')
        )
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should handle checkAndAddHsFolderToGitignore throwing without crashing', async () => {
      mockHandleLinkFlow.mockResolvedValue({
        status: 'success',
        settings: { accounts: [111], localDefaultAccount: 111 },
      });
      checkAndAddSettingsToGitignoreSpy.mockImplementation(() => {
        throw new Error('gitignore error');
      });

      await linkCommand.handler(args);

      expect(debugErrorSpy).toHaveBeenCalledWith(new Error('gitignore error'));
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });
  });
});

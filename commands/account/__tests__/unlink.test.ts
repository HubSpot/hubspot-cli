import { ArgumentsCamelCase } from 'yargs';
import * as configLib from '@hubspot/local-dev-lib/config';
import * as hsSettingsLib from '@hubspot/local-dev-lib/config/hsSettings';
import * as pathLib from '@hubspot/local-dev-lib/path';
import * as usageTrackingLib from '../../../lib/usageTracking.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import { commands } from '../../../lang/en.js';
import { LinkArgs } from '../../../types/Link.js';

const { mockUnlink } = vi.hoisted(() => ({
  mockUnlink: vi.fn(),
}));

vi.mock('@hubspot/local-dev-lib/config');
vi.mock('@hubspot/local-dev-lib/config/hsSettings');
vi.mock('@hubspot/local-dev-lib/path', () => ({
  getCwd: vi.fn().mockReturnValue('/test/project'),
}));
vi.mock('../../../lib/link/index.js', () => ({
  ActionHandlers: {
    unlink: mockUnlink,
  },
}));
vi.mock('../../../lib/commonOpts');
vi.mock('../../../lib/ui/index.js');

import unlinkCommand from '../unlink.js';

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
const getCwdSpy = vi.spyOn(pathLib, 'getCwd');
const trackCommandUsageSpy = vi.spyOn(usageTrackingLib, 'trackCommandUsage');
const processExitSpy = vi.spyOn(process, 'exit');

describe('commands/account/unlink', () => {
  let args: ArgumentsCamelCase<LinkArgs>;

  beforeEach(() => {
    localConfigFileExistsSpy.mockReturnValue(false);
    getAllConfigAccountsSpy.mockReturnValue([]);
    getHsSettingsFileSpy.mockReturnValue({
      accounts: [111, 222],
      localDefaultAccount: 111,
    });
    getHsSettingsFilePathSpy.mockReturnValue('/test/.hs/settings.json');
    writeHsSettingsFileSpy.mockImplementation(() => {});
    getCwdSpy.mockReturnValue('/test/project');
    mockUnlink.mockResolvedValue({
      status: 'success',
      settings: { accounts: [111], localDefaultAccount: 111 },
    });
    trackCommandUsageSpy.mockImplementation(async () => {});
    // @ts-expect-error Mock implementation
    processExitSpy.mockImplementation(() => {});

    args = {
      derivedAccountId: 123,
      d: false,
      debug: false,
      addUsageMetadata: vi.fn(),
      exit: vi.fn(),
      _: ['account', 'unlink'],
      $0: '',
    } as ArgumentsCamelCase<LinkArgs>;
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(unlinkCommand.command).toEqual('unlink');
    });
  });

  describe('describe', () => {
    // TODO: uncomment these tests (and remove the one below it) after we unhide the unlink command
    // it('should provide a description', () => {
    //   expect(unlinkCommand.describe).toBeDefined();
    //   expect(unlinkCommand.describe).toEqual(
    //     commands.account.subcommands.unlink.describe
    //   );
    // });

    it('should not provide a description', () => {
      expect(unlinkCommand.describe).not.toBeDefined();
      expect(unlinkCommand.describe).not.toEqual(
        commands.account.subcommands.unlink.describe
      );
    });
  });

  describe('handler', () => {
    it('should exit ERROR when localConfigFileExists returns true', async () => {
      localConfigFileExistsSpy.mockReturnValue(true);

      await unlinkCommand.handler(args);

      expect(uiLogger.error).toHaveBeenCalledWith(
        commands.account.subcommands.link.shared.deprecatedConfigNotSupported(
          'hs account unlink'
        )
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should show no-linked-accounts when settings is null', async () => {
      getHsSettingsFileSpy.mockReturnValue(null);
      getAllConfigAccountsSpy.mockReturnValue([]);

      await unlinkCommand.handler(args);

      expect(uiLogger.log).toHaveBeenCalledWith(
        commands.account.subcommands.link.shared.noLinkedAccounts
      );
      expect(uiLogger.log).toHaveBeenCalledWith(
        commands.account.subcommands.link.shared.globalAccountsAvailable(0)
      );
      expect(uiLogger.log).toHaveBeenCalledWith(
        commands.account.subcommands.link.shared.configurePrompt
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should show no-linked-accounts when settings has empty accounts array', async () => {
      getHsSettingsFileSpy.mockReturnValue({
        accounts: [],
        localDefaultAccount: undefined,
      });
      getAllConfigAccountsSpy.mockReturnValue([]);

      await unlinkCommand.handler(args);

      expect(uiLogger.log).toHaveBeenCalledWith(
        commands.account.subcommands.link.shared.noLinkedAccounts
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should pass linked settings to ActionHandlers.unlink', async () => {
      mockUnlink.mockResolvedValue({
        status: 'success',
        settings: { accounts: [111], localDefaultAccount: 111 },
      });

      await unlinkCommand.handler(args);

      expect(mockUnlink).toHaveBeenCalledWith(
        expect.objectContaining({
          state: { accounts: [111, 222], localDefaultAccount: 111 },
          args,
        })
      );
    });

    it('should write settings and show completed on status:success', async () => {
      const newSettings = {
        accounts: [111],
        localDefaultAccount: 111,
      };
      mockUnlink.mockResolvedValue({
        status: 'success',
        settings: newSettings,
      });

      await unlinkCommand.handler(args);

      expect(writeHsSettingsFileSpy).toHaveBeenCalledWith(newSettings);
      expect(uiLogger.success).toHaveBeenCalledWith(
        commands.account.subcommands.link.shared.savedToSettings(
          '/test/.hs/settings.json'
        )
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should exit error on status:error', async () => {
      mockUnlink.mockResolvedValue({
        status: 'error',
        reason: 'Something went wrong',
      });

      await unlinkCommand.handler(args);

      expect(uiLogger.error).toHaveBeenCalledWith('Something went wrong');
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should exit success on status:success', async () => {
      mockUnlink.mockResolvedValue({
        status: 'success',
        settings: { accounts: [111], localDefaultAccount: 111 },
      });

      await unlinkCommand.handler(args);

      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should exit error when writeHsSettingsFile throws', async () => {
      const newSettings = {
        accounts: [111],
        localDefaultAccount: 111,
      };
      mockUnlink.mockResolvedValue({
        status: 'success',
        settings: newSettings,
      });
      writeHsSettingsFileSpy.mockImplementation(() => {
        throw new Error('disk full');
      });

      await unlinkCommand.handler(args);

      expect(uiLogger.error).toHaveBeenCalledWith(
        commands.account.subcommands.link.shared.writeSettingsFailed(
          '/test/.hs/settings.json',
          new Error('disk full')
        )
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });
});

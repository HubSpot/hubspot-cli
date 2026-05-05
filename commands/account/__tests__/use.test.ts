/* eslint-disable @typescript-eslint/no-explicit-any */
import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import * as configLib from '@hubspot/local-dev-lib/config';
import * as defaultAccountOverrideLib from '@hubspot/local-dev-lib/config/defaultAccountOverride';
import * as hsSettingsLib from '@hubspot/local-dev-lib/config/hsSettings';
import * as usageTrackingLib from '../../../lib/usageTracking.js';
import type { UsageTrackingArgs } from '../../../types/Yargs.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';

const { mockHandleLinkedUseAction } = vi.hoisted(() => ({
  mockHandleLinkedUseAction: vi.fn(),
}));

vi.mock('@hubspot/local-dev-lib/config');
vi.mock('@hubspot/local-dev-lib/config/defaultAccountOverride');
vi.mock('@hubspot/local-dev-lib/config/hsSettings');
vi.mock('@hubspot/local-dev-lib/path', () => ({
  getCwd: vi.fn().mockReturnValue('/test/project'),
  getExt: vi.fn(),
  isRelativePath: vi.fn(),
  resolveLocalPath: vi.fn(),
}));
vi.mock('../../../lib/prompts/accountsPrompt.js');
vi.mock('../../../lib/prompts/promptUtils.js');
vi.mock('../../../lib/link/index.js', () => ({
  handleLinkedUseAction: mockHandleLinkedUseAction,
}));
vi.mock('../../../lib/commonOpts');
vi.mock('../../../lib/ui/index.js', async importOriginal => {
  const actual =
    await importOriginal<typeof import('../../../lib/ui/index.js')>();
  return {
    ...actual,
    uiAccountDescription: vi
      .fn()
      .mockImplementation((id: number) => `Account ${id}`),
  };
});

import * as accountsPromptLib from '../../../lib/prompts/accountsPrompt.js';
import * as promptUtilsLib from '../../../lib/prompts/promptUtils.js';
import accountUseCommand from '../use.js';

const getConfigFilePathSpy = vi.spyOn(configLib, 'getConfigFilePath');
const getConfigAccountIfExistsSpy = vi.spyOn(
  configLib,
  'getConfigAccountIfExists'
);
const getConfigAccountByNameSpy = vi.spyOn(configLib, 'getConfigAccountByName');
const getConfigAccountByIdSpy = vi.spyOn(configLib, 'getConfigAccountById');
const getAllConfigAccountsSpy = vi.spyOn(configLib, 'getAllConfigAccounts');
const setConfigAccountAsDefaultSpy = vi.spyOn(
  configLib,
  'setConfigAccountAsDefault'
);
const getDefaultAccountOverrideAccountIdSpy = vi.spyOn(
  defaultAccountOverrideLib,
  'getDefaultAccountOverrideAccountId'
);
const getDefaultAccountOverrideFilePathSpy = vi.spyOn(
  defaultAccountOverrideLib,
  'getDefaultAccountOverrideFilePath'
);
const getHsSettingsFileIfExistsSpy = vi.spyOn(
  hsSettingsLib,
  'getHsSettingsFileIfExists'
);
const writeHsSettingsFileSpy = vi.spyOn(hsSettingsLib, 'writeHsSettingsFile');
const getHsSettingsFilePathSpy = vi.spyOn(
  hsSettingsLib,
  'getHsSettingsFilePath'
);
const selectAccountFromConfigSpy = vi.spyOn(
  accountsPromptLib,
  'selectAccountFromConfig'
);
const confirmPromptSpy = vi.spyOn(promptUtilsLib, 'confirmPrompt');
const trackCommandUsageSpy = vi.spyOn(usageTrackingLib, 'trackCommandUsage');
const processExitSpy = vi.spyOn(process, 'exit');

const positionalSpy = vi
  .spyOn(yargs as Argv, 'positional')
  .mockReturnValue(yargs as Argv);
const exampleSpy = vi
  .spyOn(yargs as Argv, 'example')
  .mockReturnValue(yargs as Argv);

describe('commands/account/use', () => {
  const yargsMock = yargs as Argv;

  beforeEach(() => {
    // @ts-expect-error Mock implementation
    processExitSpy.mockImplementation(() => {});
    getConfigFilePathSpy.mockReturnValue('/test/.hscli.config.yaml');
    getAllConfigAccountsSpy.mockReturnValue([]);
    getDefaultAccountOverrideAccountIdSpy.mockReturnValue(null);
    getDefaultAccountOverrideFilePathSpy.mockReturnValue(null);
    getHsSettingsFileIfExistsSpy.mockReturnValue(null);
    getHsSettingsFilePathSpy.mockReturnValue(null);
    writeHsSettingsFileSpy.mockImplementation(() => {});
    trackCommandUsageSpy.mockImplementation(async () => {});
    setConfigAccountAsDefaultSpy.mockImplementation(() => {});
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(accountUseCommand.command).toEqual('use [account]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(accountUseCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      accountUseCommand.builder(yargsMock);

      expect(exampleSpy).toHaveBeenCalledTimes(1);
      expect(positionalSpy).toHaveBeenCalledTimes(1);
      expect(positionalSpy).toHaveBeenCalledWith('account', {
        describe: expect.any(String),
        type: 'string',
      });
    });
  });

  describe('handler (global — not linked)', () => {
    let args: ArgumentsCamelCase<
      {
        derivedAccountId: number;
        userProvidedAccount?: string;
        d: boolean;
        debug: boolean;
        account?: string;
      } & UsageTrackingArgs
    >;

    beforeEach(() => {
      args = {
        derivedAccountId: undefined as unknown as number,
        d: false,
        debug: false,
        _: [],
        $0: '',
        addUsageMetadata: vi.fn(),
        exit: vi.fn(),
      } as ArgumentsCamelCase<
        {
          derivedAccountId: number;
          userProvidedAccount?: string;
          d: boolean;
          debug: boolean;
          account?: string;
        } & UsageTrackingArgs
      >;
    });

    describe('with account ID', () => {
      it('should set account by ID', async () => {
        args.account = '123456';
        const account = {
          accountId: 123456,
          name: 'Test Account',
        };
        getConfigAccountIfExistsSpy.mockReturnValue(account as any);
        getConfigAccountByIdSpy.mockReturnValue(account as any);

        await accountUseCommand.handler(args);

        expect(getConfigAccountByIdSpy).toHaveBeenCalledWith(123456);
        expect(setConfigAccountAsDefaultSpy).toHaveBeenCalledWith('123456');
        expect(uiLogger.success).toHaveBeenCalled();
      });

      it('should track command usage', async () => {
        args.account = '123456';
        const account = {
          accountId: 123456,
          name: 'Test Account',
        };
        getConfigAccountIfExistsSpy.mockReturnValue(account as any);
        getConfigAccountByIdSpy.mockReturnValue(account as any);

        await accountUseCommand.handler(args);

        expect(trackCommandUsageSpy).toHaveBeenCalledWith(
          'accounts-use',
          { successful: true },
          undefined
        );
      });
    });

    describe('with account name', () => {
      it('should set account by name', async () => {
        args.account = 'MyAccount';
        const account = {
          accountId: 123456,
          name: 'MyAccount',
        };
        getConfigAccountIfExistsSpy.mockReturnValue(account as any);
        getConfigAccountByNameSpy.mockReturnValue(account as any);

        await accountUseCommand.handler(args);

        expect(getConfigAccountByNameSpy).toHaveBeenCalledWith('MyAccount');
        expect(setConfigAccountAsDefaultSpy).toHaveBeenCalledWith('MyAccount');
        expect(uiLogger.success).toHaveBeenCalled();
      });
    });

    describe('account not found', () => {
      it('should prompt when account not found', async () => {
        args.account = 'InvalidAccount';
        const account = {
          accountId: 999999,
          name: 'Selected Account',
        };
        getConfigAccountIfExistsSpy.mockReturnValue(undefined);
        selectAccountFromConfigSpy.mockResolvedValue(999999);
        getConfigAccountByIdSpy.mockReturnValue(account as any);

        await accountUseCommand.handler(args);

        expect(uiLogger.error).toHaveBeenCalled();
        expect(selectAccountFromConfigSpy).toHaveBeenCalled();
        expect(setConfigAccountAsDefaultSpy).toHaveBeenCalledWith('999999');
      });
    });

    describe('without account argument', () => {
      it('should prompt for account selection', async () => {
        const account = {
          accountId: 888888,
          name: 'Prompted Account',
        };
        selectAccountFromConfigSpy.mockResolvedValue(888888);
        getConfigAccountByIdSpy.mockReturnValue(account as any);

        await accountUseCommand.handler(args);

        expect(selectAccountFromConfigSpy).toHaveBeenCalled();
        expect(setConfigAccountAsDefaultSpy).toHaveBeenCalledWith('888888');
      });
    });

    describe('account override', () => {
      it('should warn when account override is present', async () => {
        args.account = '123456';
        const account = {
          accountId: 123456,
          name: 'Test Account',
        };
        getConfigAccountIfExistsSpy.mockReturnValue(account as any);
        getConfigAccountByIdSpy.mockReturnValue(account as any);
        getDefaultAccountOverrideAccountIdSpy.mockReturnValue(777777);
        getDefaultAccountOverrideFilePathSpy.mockReturnValue(
          '/test/override.yaml'
        );
        getAllConfigAccountsSpy.mockReturnValue([account] as any);

        await accountUseCommand.handler(args);

        expect(getDefaultAccountOverrideAccountIdSpy).toHaveBeenCalled();
        expect(uiLogger.warn).toHaveBeenCalled();
      });

      it('should not warn when no account override', async () => {
        args.account = '123456';
        const account = {
          accountId: 123456,
          name: 'Test Account',
        };
        getConfigAccountIfExistsSpy.mockReturnValue(account as any);
        getConfigAccountByIdSpy.mockReturnValue(account as any);

        await accountUseCommand.handler(args);

        expect(uiLogger.warn).not.toHaveBeenCalled();
      });
    });
  });

  describe('handler (linked directory)', () => {
    let args: ArgumentsCamelCase<
      {
        derivedAccountId: number;
        userProvidedAccount?: string;
        d: boolean;
        debug: boolean;
        account?: string;
      } & UsageTrackingArgs
    >;

    beforeEach(() => {
      args = {
        derivedAccountId: undefined as unknown as number,
        d: false,
        debug: false,
        _: [],
        $0: '',
        addUsageMetadata: vi.fn(),
        exit: vi.fn(),
      } as ArgumentsCamelCase<
        {
          derivedAccountId: number;
          userProvidedAccount?: string;
          d: boolean;
          debug: boolean;
          account?: string;
        } & UsageTrackingArgs
      >;
    });

    beforeEach(() => {
      getHsSettingsFileIfExistsSpy.mockReturnValue({
        accounts: [111, 222],
        localDefaultAccount: 111,
      });
      getHsSettingsFilePathSpy.mockReturnValue('/test/.hs/settings.json');
    });

    it('should show editing linked default message', async () => {
      mockHandleLinkedUseAction.mockResolvedValue({
        status: 'success',
        settings: { accounts: [111, 222], localDefaultAccount: 222 },
      });

      await accountUseCommand.handler(args);

      expect(uiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('not the global default')
      );
    });

    it('should call handleLinkedUseAction without targetAccountId when no positional', async () => {
      mockHandleLinkedUseAction.mockResolvedValue({
        status: 'success',
        settings: { accounts: [111, 222], localDefaultAccount: 222 },
      });

      await accountUseCommand.handler(args);

      expect(mockHandleLinkedUseAction).toHaveBeenCalledWith(
        expect.objectContaining({
          targetAccountId: undefined,
        })
      );
    });

    it('should call handleLinkedUseAction with targetAccountId when positional is linked', async () => {
      args.account = '222';
      getConfigAccountIfExistsSpy.mockReturnValue({
        accountId: 222,
        name: 'Account 222',
      } as any);
      mockHandleLinkedUseAction.mockResolvedValue({
        status: 'success',
        settings: { accounts: [111, 222], localDefaultAccount: 222 },
      });

      await accountUseCommand.handler(args);

      expect(mockHandleLinkedUseAction).toHaveBeenCalledWith(
        expect.objectContaining({
          targetAccountId: 222,
        })
      );
    });

    it('should write settings and exit on success', async () => {
      mockHandleLinkedUseAction.mockResolvedValue({
        status: 'success',
        settings: { accounts: [111, 222], localDefaultAccount: 222 },
      });

      await accountUseCommand.handler(args);

      expect(writeHsSettingsFileSpy).toHaveBeenCalledWith({
        accounts: [111, 222],
        localDefaultAccount: 222,
      });
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should exit with error when result is error', async () => {
      mockHandleLinkedUseAction.mockResolvedValue({
        status: 'error',
        reason: 'Something failed',
      });

      await accountUseCommand.handler(args);

      expect(uiLogger.error).toHaveBeenCalledWith('Something failed');
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should inform and exit when only 1 linked account', async () => {
      getHsSettingsFileIfExistsSpy.mockReturnValue({
        accounts: [111],
        localDefaultAccount: 111,
      });

      await accountUseCommand.handler(args);

      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should prompt to link when positional account is not linked', async () => {
      const originalIsTTY = process.stdin.isTTY;
      process.stdin.isTTY = true;

      args.account = '999';
      getConfigAccountIfExistsSpy.mockReturnValue({
        accountId: 999,
        name: 'Unlinked Account',
      } as any);
      confirmPromptSpy.mockResolvedValue(true);
      mockHandleLinkedUseAction.mockResolvedValue({
        status: 'success',
        settings: { accounts: [111, 222, 999], localDefaultAccount: 999 },
      });

      await accountUseCommand.handler(args);

      expect(confirmPromptSpy).toHaveBeenCalled();
      expect(mockHandleLinkedUseAction).toHaveBeenCalledWith(
        expect.objectContaining({
          targetAccountId: 999,
        })
      );

      process.stdin.isTTY = originalIsTTY;
    });

    it('should fall back to global default when user declines to link', async () => {
      const originalIsTTY = process.stdin.isTTY;
      process.stdin.isTTY = true;

      args.account = '999';
      getConfigAccountIfExistsSpy.mockReturnValue({
        accountId: 999,
        name: 'Unlinked Account',
      } as any);
      confirmPromptSpy.mockResolvedValue(false);

      await accountUseCommand.handler(args);

      expect(setConfigAccountAsDefaultSpy).toHaveBeenCalledWith('999');
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);

      process.stdin.isTTY = originalIsTTY;
    });

    it('should fall back to global when settings has empty accounts', async () => {
      getHsSettingsFileIfExistsSpy.mockReturnValue({
        accounts: [],
        localDefaultAccount: undefined,
      });
      const account = { accountId: 123, name: 'Test' };
      args.account = '123';
      getConfigAccountIfExistsSpy.mockReturnValue(account as any);
      getConfigAccountByIdSpy.mockReturnValue(account as any);

      await accountUseCommand.handler(args);

      expect(setConfigAccountAsDefaultSpy).toHaveBeenCalledWith('123');
      expect(mockHandleLinkedUseAction).not.toHaveBeenCalled();
    });

    it('should exit with error when positional account not found', async () => {
      args.account = 'nonexistent';
      getConfigAccountIfExistsSpy.mockReturnValue(undefined);
      processExitSpy.mockImplementation(() => {
        throw new Error('process.exit');
      });

      try {
        await accountUseCommand.handler(args);
      } catch {
        // process.exit throws in this test
      }

      expect(uiLogger.error).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });
});

import {
  getAllConfigAccounts,
  getConfigDefaultAccountIfExists,
} from '@hubspot/local-dev-lib/config';
import {
  getDefaultAccountOverrideFilePath,
  removeDefaultAccountOverrideFile,
} from '@hubspot/local-dev-lib/config/defaultAccountOverride';
import { authenticateNewAccount } from '../../accountAuth.js';
import { confirmPrompt } from '../../prompts/promptUtils.js';
import {
  promptForAction,
  promptForAccountsToLink,
  promptForAccountsToUnlink,
  promptForDefaultAccount,
} from '../prompts.js';
import {
  ActionHandlers,
  handleLinkFlow,
  handleLinkedUseAction,
} from '../index.js';
import { LinkContext, LinkArgs } from '../../../types/Link.js';
import { HsSettingsFile } from '@hubspot/local-dev-lib/types/HsSettings';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { ArgumentsCamelCase } from 'yargs';
import { Mock } from 'vitest';
import { uiLogger } from '../../ui/logger.js';
import { commands } from '../../../lang/en.js';

vi.mock('../prompts.js', () => ({
  promptForAction: vi.fn(),
  promptForAccountsToLink: vi.fn(),
  promptForAccountsToUnlink: vi.fn(),
  promptForDefaultAccount: vi.fn(),
}));

vi.mock('../../prompts/promptUtils.js', () => ({
  confirmPrompt: vi.fn(),
}));

vi.mock('@hubspot/local-dev-lib/config', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@hubspot/local-dev-lib/config')>();
  return {
    ...actual,
    getAllConfigAccounts: vi.fn().mockReturnValue([]),
    getConfigDefaultAccountIfExists: vi.fn().mockReturnValue(undefined),
    getConfigAccountIfExists: vi.fn().mockReturnValue(undefined),
  };
});

vi.mock('@hubspot/local-dev-lib/config/defaultAccountOverride', () => ({
  getDefaultAccountOverrideFilePath: vi.fn().mockReturnValue(null),
  removeDefaultAccountOverrideFile: vi.fn(),
}));

vi.mock('../../accountAuth.js', () => ({
  authenticateNewAccount: vi.fn(),
}));

vi.mock('../../ui/logger.js');

const mockedPromptForAction = promptForAction as Mock;
const mockedPromptForAccountsToLink = promptForAccountsToLink as Mock;
const mockedPromptForAccountsToUnlink = promptForAccountsToUnlink as Mock;
const mockedPromptForDefaultAccount = promptForDefaultAccount as Mock;
const mockedGetAllConfigAccounts = getAllConfigAccounts as Mock;
const mockedGetConfigDefaultAccountIfExists =
  getConfigDefaultAccountIfExists as Mock;
const mockedGetDefaultAccountOverrideFilePath =
  getDefaultAccountOverrideFilePath as Mock;
const mockedAuthenticateNewAccount = authenticateNewAccount as Mock;
const mockedConfirmPrompt = confirmPrompt as Mock;

const defaultArgs = {
  derivedAccountId: 123,
  d: false,
  debug: false,
  addUsageMetadata: vi.fn(),
  exit: vi.fn(),
  _: [],
  $0: '',
  qa: false,
} as ArgumentsCamelCase<LinkArgs>;

describe('lib/link/index', () => {
  describe('handleLinkFlow', () => {
    it('should log invalid default account warning', async () => {
      mockedGetAllConfigAccounts.mockReturnValue([]);
      mockedGetConfigDefaultAccountIfExists.mockReturnValue(undefined);
      mockedPromptForAction.mockResolvedValueOnce('cancel');

      const settings: HsSettingsFile = {
        accounts: [111, 222],
        localDefaultAccount: 999,
      };

      await handleLinkFlow({
        settings,
        accountOverrideId: null,
        args: defaultArgs,
      });

      expect(uiLogger.warn).toHaveBeenCalledWith(
        commands.account.subcommands.link.events.invalidDefaultAccount(999)
      );
    });

    it('should reset default when it is not in accounts list', async () => {
      mockedGetAllConfigAccounts.mockReturnValue([]);
      mockedGetConfigDefaultAccountIfExists.mockReturnValue(undefined);
      mockedPromptForAction.mockResolvedValueOnce('cancel');

      const settings: HsSettingsFile = {
        accounts: [111],
        localDefaultAccount: 999,
      };

      const result = await handleLinkFlow({
        settings,
        accountOverrideId: null,
        args: defaultArgs,
      });

      expect(result).toEqual({ status: 'noop' });
    });

    it('should not log invalid default warning when default is valid', async () => {
      mockedGetAllConfigAccounts.mockReturnValue([]);
      mockedGetConfigDefaultAccountIfExists.mockReturnValue(undefined);
      mockedPromptForAction.mockResolvedValueOnce('cancel');

      const settings: HsSettingsFile = {
        accounts: [111, 222],
        localDefaultAccount: 111,
      };

      await handleLinkFlow({
        settings,
        accountOverrideId: null,
        args: defaultArgs,
      });

      expect(uiLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('invalid')
      );
    });
  });

  describe('ActionHandlers.link', () => {
    it('should filter eligible and ineligible accounts and merge selections', async () => {
      const globalAccounts = [
        { accountId: 111 },
        { accountId: 222 },
        { accountId: 333 },
      ] as HubSpotConfigAccount[];

      mockedPromptForAccountsToLink.mockResolvedValueOnce([222, 333]);
      mockedPromptForDefaultAccount.mockResolvedValueOnce(222);
      mockedGetDefaultAccountOverrideFilePath.mockReturnValue(null);

      const state: HsSettingsFile = {
        accounts: [111],
        localDefaultAccount: 111,
      };

      const context: LinkContext = {
        globalAccountsList: globalAccounts,
        globalDefaultAccount: undefined,
        accountOverrideId: null,
      };

      const result = await ActionHandlers.link({
        state,
        context,
        args: defaultArgs,
      });

      expect(mockedPromptForAccountsToLink).toHaveBeenCalledWith(
        context,
        [{ accountId: 222 }, { accountId: 333 }],
        [{ accountId: 111 }],
        111
      );
      expect(uiLogger.info).toHaveBeenCalledWith(
        commands.account.subcommands.link.events.accountsLinked(2)
      );
      expect(result).toEqual({
        status: 'success',
        settings: {
          accounts: [111, 222, 333],
          localDefaultAccount: 222,
        },
      });
    });

    it('should auto-set default when linking results in single account', async () => {
      const globalAccounts = [{ accountId: 111 }] as HubSpotConfigAccount[];

      mockedPromptForAccountsToLink.mockResolvedValueOnce([111]);
      mockedGetDefaultAccountOverrideFilePath.mockReturnValue(null);

      const state: HsSettingsFile = {
        accounts: [],
        localDefaultAccount: undefined,
      };

      const context: LinkContext = {
        globalAccountsList: globalAccounts,
        globalDefaultAccount: undefined,
        accountOverrideId: null,
      };

      const result = await ActionHandlers.link({
        state,
        context,
        args: defaultArgs,
      });

      expect(mockedPromptForDefaultAccount).not.toHaveBeenCalled();
      expect(uiLogger.success).toHaveBeenCalledWith(
        commands.account.subcommands.link.events.defaultAccountSet(111)
      );
      expect(uiLogger.info).toHaveBeenCalledWith(
        commands.account.subcommands.link.events.accountsLinked(1)
      );
      expect(result).toEqual({
        status: 'success',
        settings: {
          accounts: [111],
          localDefaultAccount: 111,
        },
      });
    });

    it('should handle override file when accountOverrideId is in accounts', async () => {
      const globalAccounts = [{ accountId: 111 }] as HubSpotConfigAccount[];

      mockedPromptForAccountsToLink.mockResolvedValueOnce([111]);
      mockedGetDefaultAccountOverrideFilePath.mockReturnValue(
        '/some/dir/.hsaccount'
      );
      mockedConfirmPrompt.mockResolvedValueOnce(true);

      const state: HsSettingsFile = {
        accounts: [],
        localDefaultAccount: undefined,
      };

      const context: LinkContext = {
        globalAccountsList: globalAccounts,
        globalDefaultAccount: undefined,
        accountOverrideId: 111,
      };

      const result = await ActionHandlers.link({
        state,
        context,
        args: defaultArgs,
      });

      expect(uiLogger.log).toHaveBeenCalledWith(
        commands.account.subcommands.link.events.overrideAccountDetected(111)
      );
      expect(uiLogger.success).toHaveBeenCalledWith(
        commands.account.subcommands.link.events.overrideFileRemoved
      );
      expect(uiLogger.success).toHaveBeenCalledWith(
        commands.account.subcommands.link.events.defaultAccountSet(111)
      );
      expect(removeDefaultAccountOverrideFile).toHaveBeenCalled();
      expect(result).toEqual({
        status: 'success',
        settings: {
          accounts: [111],
          localDefaultAccount: 111,
        },
      });
    });

    it('should remove override file even when user declines keepAsDefault', async () => {
      const globalAccounts = [{ accountId: 111 }] as HubSpotConfigAccount[];

      mockedPromptForAccountsToLink.mockResolvedValueOnce([111]);
      mockedGetDefaultAccountOverrideFilePath.mockReturnValue(
        '/some/dir/.hsaccount'
      );
      mockedConfirmPrompt.mockResolvedValueOnce(false);

      const state: HsSettingsFile = {
        accounts: [],
        localDefaultAccount: undefined,
      };

      const context: LinkContext = {
        globalAccountsList: globalAccounts,
        globalDefaultAccount: undefined,
        accountOverrideId: 111,
      };

      await ActionHandlers.link({
        state,
        context,
        args: defaultArgs,
      });

      expect(removeDefaultAccountOverrideFile).toHaveBeenCalled();
      expect(uiLogger.success).toHaveBeenCalledWith(
        commands.account.subcommands.link.events.overrideFileRemoved
      );
    });
  });

  describe('ActionHandlers.authenticate', () => {
    it('should return error when authentication fails', async () => {
      mockedAuthenticateNewAccount.mockResolvedValueOnce(null);

      const state: HsSettingsFile = {
        accounts: [],
        localDefaultAccount: undefined,
      };

      const context: LinkContext = {
        globalAccountsList: [],
        globalDefaultAccount: undefined,
        accountOverrideId: null,
      };

      const result = await ActionHandlers.authenticate({
        state,
        context,
        args: defaultArgs,
      });

      expect(result).toEqual({
        status: 'error',
        reason: 'Authentication failed to complete',
      });
    });

    it('should go to account selection with new account pre-checked on successful authentication', async () => {
      const newAccount = { accountId: 999 } as HubSpotConfigAccount;
      mockedAuthenticateNewAccount.mockResolvedValueOnce(newAccount);
      mockedGetAllConfigAccounts.mockReturnValue([newAccount]);
      mockedGetConfigDefaultAccountIfExists.mockReturnValue(undefined);
      mockedPromptForAccountsToLink.mockResolvedValueOnce([999]);

      const state: HsSettingsFile = {
        accounts: [],
        localDefaultAccount: undefined,
      };

      const context: LinkContext = {
        globalAccountsList: [],
        globalDefaultAccount: undefined,
        accountOverrideId: null,
      };

      const result = await ActionHandlers.authenticate({
        state,
        context,
        args: defaultArgs,
      });

      expect(mockedPromptForAccountsToLink).toHaveBeenCalledWith(
        expect.objectContaining({ preselectedAccountId: 999 }),
        expect.any(Array),
        expect.any(Array),
        undefined
      );
      expect(uiLogger.info).toHaveBeenCalledWith(
        commands.account.subcommands.link.events.accountsLinked(1)
      );
      expect(result).toEqual({
        status: 'success',
        settings: { accounts: [999], localDefaultAccount: 999 },
      });
    });

    it('should add new account to existing linked accounts on auth', async () => {
      const existingAccount = { accountId: 111 } as HubSpotConfigAccount;
      const newAccount = { accountId: 999 } as HubSpotConfigAccount;
      mockedAuthenticateNewAccount.mockResolvedValueOnce(newAccount);
      mockedGetAllConfigAccounts.mockReturnValue([existingAccount, newAccount]);
      mockedGetConfigDefaultAccountIfExists.mockReturnValue(undefined);
      mockedPromptForAccountsToLink.mockResolvedValueOnce([999]);
      mockedPromptForDefaultAccount.mockResolvedValueOnce(111);

      const state: HsSettingsFile = {
        accounts: [111],
        localDefaultAccount: 111,
      };

      const context: LinkContext = {
        globalAccountsList: [existingAccount],
        globalDefaultAccount: undefined,
        accountOverrideId: null,
      };

      const result = await ActionHandlers.authenticate({
        state,
        context,
        args: defaultArgs,
      });

      expect(uiLogger.info).toHaveBeenCalledWith(
        commands.account.subcommands.link.events.accountsLinked(1)
      );
      expect(result).toEqual({
        status: 'success',
        settings: {
          accounts: [111, 999],
          localDefaultAccount: 111,
        },
      });
    });

    it('should preserve accountOverrideId in updated context', async () => {
      const newAccount = { accountId: 999 } as HubSpotConfigAccount;
      mockedAuthenticateNewAccount.mockResolvedValueOnce(newAccount);
      mockedGetAllConfigAccounts.mockReturnValue([newAccount]);
      mockedGetConfigDefaultAccountIfExists.mockReturnValue(undefined);
      mockedPromptForAccountsToLink.mockResolvedValueOnce([999]);

      const state: HsSettingsFile = {
        accounts: [],
        localDefaultAccount: undefined,
      };

      const context: LinkContext = {
        globalAccountsList: [],
        globalDefaultAccount: undefined,
        accountOverrideId: 555,
      };

      await ActionHandlers.authenticate({
        state,
        context,
        args: defaultArgs,
      });

      expect(mockedPromptForAccountsToLink).toHaveBeenCalledWith(
        expect.objectContaining({
          accountOverrideId: 555,
          preselectedAccountId: 999,
        }),
        expect.any(Array),
        expect.any(Array),
        undefined
      );
    });
  });

  describe('ActionHandlers.unlink', () => {
    const baseContext: LinkContext = {
      globalAccountsList: [],
      globalDefaultAccount: undefined,
      accountOverrideId: null,
    };

    it('should handle all accounts removed', async () => {
      mockedPromptForAccountsToUnlink.mockResolvedValueOnce([111, 222]);

      const state: HsSettingsFile = {
        accounts: [111, 222],
        localDefaultAccount: 111,
      };

      const result = await ActionHandlers.unlink({
        state,
        context: baseContext,
        args: defaultArgs,
      });

      expect(uiLogger.success).toHaveBeenCalledWith(
        commands.account.subcommands.link.events.noAccountsLinked
      );
      expect(result).toEqual({
        status: 'success',
        settings: { accounts: [], localDefaultAccount: undefined },
      });
    });

    it('should handle default not removed', async () => {
      mockedPromptForAccountsToUnlink.mockResolvedValueOnce([222]);

      const state: HsSettingsFile = {
        accounts: [111, 222],
        localDefaultAccount: 111,
      };

      const result = await ActionHandlers.unlink({
        state,
        context: baseContext,
        args: defaultArgs,
      });

      expect(uiLogger.success).toHaveBeenCalledWith(
        commands.account.subcommands.link.events.accountsUnlinked(1)
      );
      expect(uiLogger.success).toHaveBeenCalledWith(
        commands.account.subcommands.link.events.defaultAccountRemains(111)
      );
      expect(result).toEqual({
        status: 'success',
        settings: { accounts: [111], localDefaultAccount: 111 },
      });
    });

    it('should prompt for new default when default is removed', async () => {
      mockedPromptForAccountsToUnlink.mockResolvedValueOnce([111]);
      mockedPromptForDefaultAccount.mockResolvedValueOnce(222);

      const state: HsSettingsFile = {
        accounts: [111, 222, 333],
        localDefaultAccount: 111,
      };

      const result = await ActionHandlers.unlink({
        state,
        context: baseContext,
        args: defaultArgs,
      });

      expect(uiLogger.warn).toHaveBeenCalledWith(
        commands.account.subcommands.link.events.defaultAccountRemoved(true)
      );
      expect(result).toEqual({
        status: 'success',
        settings: { accounts: [222, 333], localDefaultAccount: 222 },
      });
    });

    it('should auto-select default when only one account remains', async () => {
      mockedPromptForAccountsToUnlink.mockResolvedValueOnce([111]);

      const state: HsSettingsFile = {
        accounts: [111, 222],
        localDefaultAccount: 111,
      };

      const result = await ActionHandlers.unlink({
        state,
        context: baseContext,
        args: defaultArgs,
      });

      expect(uiLogger.warn).toHaveBeenCalledWith(
        commands.account.subcommands.link.events.defaultAccountRemoved(false)
      );
      expect(uiLogger.success).toHaveBeenCalledWith(
        commands.account.subcommands.link.events.updatedLinkedAccounts
      );
      expect(uiLogger.success).toHaveBeenCalledWith(
        commands.account.subcommands.link.events.defaultAccountSet(222)
      );
      expect(result).toEqual({
        status: 'success',
        settings: { accounts: [222], localDefaultAccount: 222 },
      });
    });
  });

  describe('handleLinkedUseAction', () => {
    it('should set default when targetAccountId is already linked', async () => {
      const state: HsSettingsFile = {
        accounts: [111, 222],
        localDefaultAccount: 111,
      };

      const result = await handleLinkedUseAction({
        state,
        targetAccountId: 222,
      });

      expect(uiLogger.success).toHaveBeenCalledWith(
        commands.account.subcommands.link.events.defaultAccountSet(222)
      );
      expect(result).toEqual({
        status: 'success',
        settings: { accounts: [111, 222], localDefaultAccount: 222 },
      });
    });

    it('should link and set default when targetAccountId is not linked', async () => {
      const state: HsSettingsFile = {
        accounts: [111],
        localDefaultAccount: 111,
      };

      const result = await handleLinkedUseAction({
        state,
        targetAccountId: 999,
      });

      expect(uiLogger.info).toHaveBeenCalledWith(
        commands.account.subcommands.link.events.accountsLinked(1)
      );
      expect(uiLogger.success).toHaveBeenCalledWith(
        commands.account.subcommands.link.events.defaultAccountSet(999)
      );
      expect(result).toEqual({
        status: 'success',
        settings: { accounts: [111, 999], localDefaultAccount: 999 },
      });
    });

    it('should prompt for default when no targetAccountId', async () => {
      mockedPromptForDefaultAccount.mockResolvedValueOnce(222);
      const state: HsSettingsFile = {
        accounts: [111, 222],
        localDefaultAccount: 111,
      };

      const result = await handleLinkedUseAction({
        state,
      });

      expect(mockedPromptForDefaultAccount).toHaveBeenCalled();
      expect(uiLogger.success).toHaveBeenCalledWith(
        commands.account.subcommands.link.events.defaultAccountSet(222)
      );
      expect(result).toEqual({
        status: 'success',
        settings: { accounts: [111, 222], localDefaultAccount: 222 },
      });
    });

    it('should auto-select when only one account and no targetAccountId', async () => {
      const state: HsSettingsFile = {
        accounts: [111],
        localDefaultAccount: undefined,
      };

      const result = await handleLinkedUseAction({
        state,
      });

      expect(mockedPromptForDefaultAccount).not.toHaveBeenCalled();
      expect(uiLogger.success).toHaveBeenCalledWith(
        commands.account.subcommands.link.events.defaultAccountSet(111)
      );
      expect(result).toEqual({
        status: 'success',
        settings: { accounts: [111], localDefaultAccount: 111 },
      });
    });
  });

  describe('ActionHandlers.cancel', () => {
    it('should return noop', async () => {
      const result = await ActionHandlers.cancel();

      expect(result).toEqual({ status: 'noop' });
    });
  });
});

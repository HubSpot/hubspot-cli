import { promptUser } from '../../prompts/promptUtils.js';
import { buildAccountRow } from '../accountTableUtils.js';
import {
  promptForAction,
  promptForDefaultAccount,
  promptForAccountsToLink,
  promptForAccountsToUnlink,
} from '../prompts.js';
import { HsSettingsFile } from '@hubspot/local-dev-lib/types/HsSettings';
import { LinkContext } from '../../../types/Link.js';
import { Mock } from 'vitest';

vi.mock('../../prompts/promptUtils.js', () => ({
  promptUser: vi.fn(),
}));

vi.mock('../../ui/index.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../../ui/index.js')>();
  return {
    ...actual,
    uiAccountDescription: vi.fn().mockReturnValue('Account 123'),
  };
});

vi.mock('../accountTableUtils.js', async importOriginal => {
  const actual =
    await importOriginal<typeof import('../accountTableUtils.js')>();
  return {
    ...actual,
    buildAccountRow: vi.fn().mockImplementation((accountId: number) => ({
      name: `Test Account ${accountId}`,
      accountId: String(accountId),
    })),
    getNameColumnWidth: vi.fn().mockReturnValue(20),
    buildAccountHeader: vi.fn().mockReturnValue('header'),
  };
});

vi.mock('@inquirer/prompts', () => ({
  Separator: class Separator {
    constructor(public text: string) {}
  },
}));

vi.mock('../index.js', () => ({
  ActionHandlers: {
    link: vi.fn(),
    unlink: vi.fn(),
    authenticate: vi.fn(),
    changeDefault: vi.fn(),
    showConfig: vi.fn(),
    cancel: vi.fn(),
  },
}));

const mockedPromptUser = promptUser as Mock;

describe('lib/link/prompts', () => {
  describe('promptForAction', () => {
    it('should use howToProceed message when state is empty', async () => {
      mockedPromptUser.mockResolvedValueOnce({ accountEditOption: 'link' });

      const emptyState: HsSettingsFile = {
        accounts: [],
        localDefaultAccount: undefined,
      };

      const result = await promptForAction(emptyState);

      expect(result).toBe('link');
      expect(mockedPromptUser).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'list',
          name: 'accountEditOption',
          message: 'How would you like to link an account?',
        })
      );
    });

    it('should use whatToDo message when state is populated', async () => {
      mockedPromptUser.mockResolvedValueOnce({
        accountEditOption: 'unlink',
      });

      const populatedState: HsSettingsFile = {
        accounts: [111, 222],
        localDefaultAccount: 111,
      };

      const result = await promptForAction(populatedState);

      expect(result).toBe('unlink');
      expect(mockedPromptUser).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'list',
          name: 'accountEditOption',
          message: 'Which action would you like to perform?',
        })
      );
    });

    it('should include link, authenticate, and cancel choices for empty state', async () => {
      mockedPromptUser.mockResolvedValueOnce({
        accountEditOption: 'cancel',
      });

      const emptyState: HsSettingsFile = {
        accounts: [],
        localDefaultAccount: undefined,
      };

      await promptForAction(emptyState);

      const callArgs = mockedPromptUser.mock.calls[0][0];
      const choiceValues = callArgs.choices.map(
        (c: { value: string }) => c.value
      );
      expect(choiceValues).toEqual(['link', 'authenticate', 'cancel']);
    });

    it('should include link, authenticate, and cancel choices for populated state', async () => {
      mockedPromptUser.mockResolvedValueOnce({
        accountEditOption: 'cancel',
      });

      const populatedState: HsSettingsFile = {
        accounts: [111],
        localDefaultAccount: 111,
      };

      await promptForAction(populatedState);

      const callArgs = mockedPromptUser.mock.calls[0][0];
      const choiceValues = callArgs.choices.map(
        (c: { value: string }) => c.value
      );
      expect(choiceValues).toEqual(['link', 'authenticate', 'cancel']);
    });
  });

  describe('promptForDefaultAccount', () => {
    it('should call promptUser with list type and return selected account', async () => {
      mockedPromptUser.mockResolvedValueOnce({ defaultAccount: 456 });

      const result = await promptForDefaultAccount([123, 456], 123);

      expect(result).toBe(456);
      expect(mockedPromptUser).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'list',
          name: 'defaultAccount',
        })
      );
    });

    it('should use custom prompt message when provided', async () => {
      mockedPromptUser.mockResolvedValueOnce({ defaultAccount: 123 });

      await promptForDefaultAccount([123, 456], undefined, 'Pick one');

      expect(mockedPromptUser).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Pick one',
        })
      );
    });

    it('should use default prompt message when no custom prompt is given', async () => {
      mockedPromptUser.mockResolvedValueOnce({ defaultAccount: 123 });

      await promptForDefaultAccount([123], undefined);

      expect(mockedPromptUser).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Select a linked default account',
        })
      );
    });
  });

  describe('promptForAccountsToLink', () => {
    const context: LinkContext = {
      globalAccountsList: [],
      globalDefaultAccount: undefined,
      accountOverrideId: null,
    };

    it('should use checkbox type and return selected accounts', async () => {
      mockedPromptUser.mockResolvedValueOnce({ accountsToAdd: [111, 222] });

      const eligible = [{ accountId: 111 }, { accountId: 222 }] as Parameters<
        typeof promptForAccountsToLink
      >[1];
      const inEligible = [] as Parameters<typeof promptForAccountsToLink>[2];

      const result = await promptForAccountsToLink(
        context,
        eligible,
        inEligible,
        undefined
      );

      expect(result).toEqual([111, 222]);
      expect(mockedPromptUser).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'checkbox',
          name: 'accountsToAdd',
        })
      );
    });

    it('should pre-check and hint the accountOverrideId account', async () => {
      mockedPromptUser.mockResolvedValueOnce({ accountsToAdd: [111] });

      const overrideContext: LinkContext = {
        globalAccountsList: [],
        globalDefaultAccount: undefined,
        accountOverrideId: 111,
      };

      const eligible = [{ accountId: 111 }, { accountId: 222 }] as Parameters<
        typeof promptForAccountsToLink
      >[1];
      const inEligible = [] as Parameters<typeof promptForAccountsToLink>[2];

      await promptForAccountsToLink(
        overrideContext,
        eligible,
        inEligible,
        undefined
      );

      const callArgs = mockedPromptUser.mock.calls[0][0];
      const choices = callArgs.choices.filter(
        (c: { value?: number }) => c.value !== undefined
      );
      const overrideChoice = choices.find(
        (c: { value: number }) => c.value === 111
      );
      const otherChoice = choices.find(
        (c: { value: number }) => c.value === 222
      );

      expect(overrideChoice.checked).toBe(true);
      expect(overrideChoice.name).toContain('(from .hsaccount)');
      expect(otherChoice.checked).toBe(false);
    });

    it('should pre-check and hint the preselectedAccountId account', async () => {
      mockedPromptUser.mockResolvedValueOnce({ accountsToAdd: [222] });

      const preselectedContext: LinkContext = {
        globalAccountsList: [],
        globalDefaultAccount: undefined,
        accountOverrideId: null,
        preselectedAccountId: 222,
      };

      const eligible = [{ accountId: 111 }, { accountId: 222 }] as Parameters<
        typeof promptForAccountsToLink
      >[1];
      const inEligible = [] as Parameters<typeof promptForAccountsToLink>[2];

      await promptForAccountsToLink(
        preselectedContext,
        eligible,
        inEligible,
        undefined
      );

      const callArgs = mockedPromptUser.mock.calls[0][0];
      const choices = callArgs.choices.filter(
        (c: { value?: number }) => c.value !== undefined
      );
      const preselectedChoice = choices.find(
        (c: { value: number }) => c.value === 222
      );
      const otherChoice = choices.find(
        (c: { value: number }) => c.value === 111
      );

      expect(preselectedChoice.checked).toBe(true);
      expect(preselectedChoice.name).toContain('(just authenticated)');
      expect(otherChoice.checked).toBe(false);
      expect(otherChoice.name).not.toContain('(');
    });

    it('should reject empty selections via validate', async () => {
      mockedPromptUser.mockResolvedValueOnce({ accountsToAdd: [111] });

      const eligible = [{ accountId: 111 }] as Parameters<
        typeof promptForAccountsToLink
      >[1];
      const inEligible = [] as Parameters<typeof promptForAccountsToLink>[2];

      await promptForAccountsToLink(context, eligible, inEligible, undefined);

      const callArgs = mockedPromptUser.mock.calls[0][0];
      const validate = callArgs.validate as (answer: number[]) => string | true;

      expect(validate([])).toBe('You must select at least one account to link');
      expect(validate([111])).toBe(true);
    });
  });

  describe('promptForAccountsToUnlink', () => {
    it('should use checkbox type and return selected accounts', async () => {
      mockedPromptUser.mockResolvedValueOnce({
        accountsToRemove: [111],
      });

      const result = await promptForAccountsToUnlink([111, 222], 111);

      expect(result).toEqual([111]);
      expect(mockedPromptUser).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'checkbox',
          name: 'accountsToRemove',
        })
      );
    });

    it('should call buildAccountRow for each account', async () => {
      mockedPromptUser.mockResolvedValueOnce({
        accountsToRemove: [],
      });

      await promptForAccountsToUnlink([111, 222], 111);

      expect(buildAccountRow).toHaveBeenCalledTimes(2);
    });
  });
});

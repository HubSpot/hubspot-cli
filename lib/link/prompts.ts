import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { promptUser } from '../prompts/promptUtils.js';
import { uiAccountDescription } from '../ui/index.js';
import { ActionName, LinkContext } from '../../types/Link.js';
import { PromptChoices } from '../../types/Prompts.js';
import { uiLogger } from '../ui/logger.js';
import { HsSettingsFile } from '@hubspot/local-dev-lib/types/HsSettings';
import { commands } from '../../lang/en.js';
import {
  buildAccountRow,
  getNameColumnWidth,
  AccountRow,
  buildAccountHeader,
  sortDefaultFirst,
} from './accountTableUtils.js';
import { Separator } from '@inquirer/prompts';

function buildColumnarChoices(
  accounts: {
    accountId: number;
    disabled?: string | false;
    checked?: boolean;
    hint?: string;
  }[],
  localDefaultAccount: number | undefined
): PromptChoices {
  const rows: (AccountRow & {
    disabled?: string | false;
    checked?: boolean;
    hint?: string;
  })[] = accounts.map(a => ({
    ...buildAccountRow(a.accountId, a.accountId === localDefaultAccount),
    disabled: a.disabled,
    checked: a.checked,
    hint: a.hint,
  }));

  const nameWidth = getNameColumnWidth(rows);
  const header = buildAccountHeader(nameWidth);

  return [
    new Separator(header),
    ...rows.map(row => {
      const label = `${row.name.padEnd(nameWidth)}  ${row.accountId}`;
      return {
        name: row.hint ? `${label}  ${row.hint}` : label,
        short: uiAccountDescription(Number(row.accountId), false),
        value: Number(row.accountId),
        disabled: row.disabled,
        checked: row.checked,
      };
    }),
  ];
}

function mapLinkAccountChoices(
  eligibleAccounts: HubSpotConfigAccount[],
  inEligibleAccounts: HubSpotConfigAccount[],
  accountOverrideId: number | null,
  localDefaultAccount: number | undefined,
  preselectedAccountId?: number
): PromptChoices {
  const sortedIneligible = sortDefaultFirst(
    inEligibleAccounts,
    localDefaultAccount
  );

  const accounts = [
    ...eligibleAccounts.map(a => ({
      accountId: a.accountId,
      disabled: false as const,
      checked:
        a.accountId === accountOverrideId ||
        a.accountId === preselectedAccountId,
      hint:
        a.accountId === accountOverrideId
          ? commands.account.subcommands.link.prompts.fromHsAccount
          : a.accountId === preselectedAccountId
            ? commands.account.subcommands.link.prompts.newlyAuthenticated
            : undefined,
    })),
    ...sortedIneligible.map(a => ({
      accountId: a.accountId,
      disabled: commands.account.subcommands.link.prompts.alreadyLinked,
      checked: false,
    })),
  ];

  return buildColumnarChoices(accounts, localDefaultAccount);
}

export async function promptForAction(
  state: HsSettingsFile
): Promise<ActionName> {
  const isSettingsEmpty =
    state.accounts.length === 0 && state.localDefaultAccount === undefined;
  const { accountEditOption } = await promptUser<{
    accountEditOption: ActionName;
  }>({
    type: 'list',
    name: 'accountEditOption',
    message: isSettingsEmpty
      ? commands.account.subcommands.link.prompts.howToProceed
      : commands.account.subcommands.link.prompts.whatToDo,
    choices: [
      {
        name: commands.account.subcommands.link.prompts.linkExisting,
        value: 'link',
      },
      {
        name: commands.account.subcommands.link.prompts.authenticateNew,
        value: 'authenticate',
      },
      {
        name: commands.account.subcommands.link.prompts.cancel,
        value: 'cancel',
      },
    ],
  });
  uiLogger.log('');
  return accountEditOption;
}

export async function promptForDefaultAccount(
  accounts: number[],
  currentDefaultAccount: number | undefined,
  prompt = ''
): Promise<number> {
  const choiceAccounts = accounts.map(accountId => ({
    accountId,
  }));
  const choices = buildColumnarChoices(choiceAccounts, currentDefaultAccount);

  const { defaultAccount } = await promptUser<{ defaultAccount: number }>({
    type: 'list',
    name: 'defaultAccount',
    pageSize: 20,
    message: prompt || commands.account.subcommands.link.prompts.selectDefault,
    choices,
    default: currentDefaultAccount ?? undefined,
  });
  uiLogger.log('');
  return defaultAccount;
}

export async function promptForAccountsToLink(
  context: LinkContext,
  eligibleAccounts: HubSpotConfigAccount[],
  inEligibleAccounts: HubSpotConfigAccount[],
  localDefaultAccount: number | undefined
): Promise<number[]> {
  const { accountsToAdd } = await promptUser<{ accountsToAdd: number[] }>({
    type: 'checkbox',
    name: 'accountsToAdd',
    pageSize: 20,
    message: commands.account.subcommands.link.prompts.selectToLink,
    choices: mapLinkAccountChoices(
      eligibleAccounts,
      inEligibleAccounts,
      context.accountOverrideId,
      localDefaultAccount,
      context.preselectedAccountId
    ),
    validate: (answer: number[]) => {
      if (answer.length === 0) {
        return commands.account.subcommands.link.prompts.mustSelectOne;
      }
      return true;
    },
  });
  uiLogger.log('');
  return accountsToAdd;
}

export async function promptForAccountsToUnlink(
  accounts: number[],
  localDefaultAccount: number | undefined
): Promise<number[]> {
  const sortedAccounts = sortDefaultFirst(accounts, localDefaultAccount);

  const choiceAccounts = sortedAccounts.map(accountId => ({
    accountId,
  }));
  const choices = buildColumnarChoices(choiceAccounts, localDefaultAccount);

  const { accountsToRemove } = await promptUser<{
    accountsToRemove: number[];
  }>({
    type: 'checkbox',
    name: 'accountsToRemove',
    pageSize: 20,
    message: commands.account.subcommands.link.prompts.selectToUnlink,
    choices,
  });
  uiLogger.log('');
  return accountsToRemove;
}

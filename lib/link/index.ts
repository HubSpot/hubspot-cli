import { HsSettingsFile } from '@hubspot/local-dev-lib/types/HsSettings';
import {
  getAllConfigAccounts,
  getConfigDefaultAccountIfExists,
} from '@hubspot/local-dev-lib/config';
import { confirmPrompt } from '../prompts/promptUtils.js';
import {
  promptForAccountsToLink,
  promptForAccountsToUnlink,
  promptForAction,
  promptForDefaultAccount,
} from './prompts.js';
import {
  ACTION_RESULT_STATUS,
  ActionHandler,
  ActionHandlerParams,
  LinkContext,
  ActionResult,
  LinkArgs,
} from '../../types/Link.js';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import {
  getDefaultAccountOverrideFilePath,
  removeDefaultAccountOverrideFile,
} from '@hubspot/local-dev-lib/config/defaultAccountOverride';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { authenticateNewAccount } from '../accountAuth.js';
import { ArgumentsCamelCase } from 'yargs';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../ui/logger.js';

export class ActionHandlers {
  static async link({
    state,
    context,
  }: ActionHandlerParams): Promise<ActionResult> {
    const { eligibleAccounts, inEligibleAccounts } =
      context.globalAccountsList.reduce<{
        eligibleAccounts: HubSpotConfigAccount[];
        inEligibleAccounts: HubSpotConfigAccount[];
      }>(
        (accumulator, account) => {
          if (state.accounts.includes(account.accountId)) {
            accumulator.inEligibleAccounts.push(account);
          } else {
            accumulator.eligibleAccounts.push(account);
          }
          return accumulator;
        },
        { eligibleAccounts: [], inEligibleAccounts: [] }
      );

    const toAdd = await promptForAccountsToLink(
      context,
      eligibleAccounts,
      inEligibleAccounts,
      state.localDefaultAccount
    );
    const accounts = [...state.accounts, ...toAdd];
    uiLogger.info(
      commands.account.subcommands.link.events.accountsLinked(toAdd.length)
    );

    const overrideFilePath = getDefaultAccountOverrideFilePath();
    if (
      overrideFilePath &&
      context.accountOverrideId &&
      accounts.includes(context.accountOverrideId)
    ) {
      uiLogger.log(
        commands.account.subcommands.link.events.overrideAccountDetected(
          context.accountOverrideId
        )
      );
      uiLogger.log('');
      const useOverride = await confirmPrompt(
        commands.account.subcommands.link.prompts.keepAsDefault
      );

      removeDefaultAccountOverrideFile();
      uiLogger.success(
        commands.account.subcommands.link.events.overrideFileRemoved
      );

      if (useOverride) {
        uiLogger.success(
          commands.account.subcommands.link.events.defaultAccountSet(
            context.accountOverrideId
          )
        );
        return {
          status: ACTION_RESULT_STATUS.SUCCESS,
          settings: {
            accounts,
            localDefaultAccount: context.accountOverrideId,
          },
        };
      }
    }

    const localDefaultAccount = await resolveDefaultAccount({
      accounts,
      currentDefault: state.localDefaultAccount,
    });
    return {
      status: ACTION_RESULT_STATUS.SUCCESS,
      settings: { accounts, localDefaultAccount },
    };
  }

  static async unlink({ state }: ActionHandlerParams): Promise<ActionResult> {
    const toRemove = await promptForAccountsToUnlink(
      state.accounts,
      state.localDefaultAccount
    );

    if (toRemove.length === 0) {
      return { status: ACTION_RESULT_STATUS.NOOP };
    }

    const remainingAccounts = state.accounts.filter(
      account => !toRemove.includes(account)
    );

    const defaultWasRemoved =
      state.localDefaultAccount !== undefined &&
      toRemove.includes(state.localDefaultAccount);

    // All accounts removed
    if (remainingAccounts.length === 0) {
      uiLogger.success(
        commands.account.subcommands.link.events.noAccountsLinked
      );
      return {
        status: ACTION_RESULT_STATUS.SUCCESS,
        settings: {
          accounts: remainingAccounts,
          localDefaultAccount: undefined,
        },
      };
    }

    //  Default was NOT removed — accounts remain, default unchanged
    if (!defaultWasRemoved) {
      uiLogger.success(
        commands.account.subcommands.link.events.accountsUnlinked(
          toRemove.length
        )
      );
      uiLogger.success(
        commands.account.subcommands.link.events.defaultAccountRemains(
          state.localDefaultAccount!
        )
      );
      return {
        status: ACTION_RESULT_STATUS.SUCCESS,
        settings: {
          accounts: remainingAccounts,
          localDefaultAccount: state.localDefaultAccount,
        },
      };
    }

    //  Default WAS removed — need a new default
    uiLogger.warn(
      commands.account.subcommands.link.events.defaultAccountRemoved(
        remainingAccounts.length !== 1
      )
    );

    const localDefaultAccount = await resolveDefaultAccount({
      accounts: remainingAccounts,
      currentDefault: undefined,
    });

    if (remainingAccounts.length === 1) {
      uiLogger.success(
        commands.account.subcommands.link.events.updatedLinkedAccounts
      );
    }
    return {
      status: ACTION_RESULT_STATUS.SUCCESS,
      settings: { accounts: remainingAccounts, localDefaultAccount },
    };
  }

  static async authenticate({
    state,
    context,
    args,
  }: ActionHandlerParams): Promise<ActionResult> {
    const updatedConfig = await authenticateNewAccount({
      env: args.qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD,
      setAsDefaultAccount: false,
    });

    if (!updatedConfig) {
      return {
        status: ACTION_RESULT_STATUS.ERROR,
        reason: commands.account.subcommands.link.errors.authFailed,
      };
    }

    const updatedContext: LinkContext = {
      globalAccountsList: getAllConfigAccounts(),
      globalDefaultAccount: getConfigDefaultAccountIfExists(),
      accountOverrideId: context.accountOverrideId,
      preselectedAccountId: updatedConfig.accountId,
    };

    return ActionHandlers.link({ state, context: updatedContext, args });
  }

  static async cancel(): Promise<ActionResult> {
    return {
      status: ACTION_RESULT_STATUS.NOOP,
    };
  }
}

export async function handleLinkFlow({
  settings,
  accountOverrideId,
  args,
}: {
  settings: HsSettingsFile;
  accountOverrideId: number | null;
  args: ArgumentsCamelCase<LinkArgs>;
}): Promise<ActionResult> {
  const context: LinkContext = {
    globalAccountsList: getAllConfigAccounts(),
    globalDefaultAccount: getConfigDefaultAccountIfExists(),
    accountOverrideId,
  };

  const accounts = settings.accounts ?? [];

  // The default account must be one of the linked accounts. This can get
  // out of sync if the settings file is manually edited.
  const hasInvalidDefault =
    settings.localDefaultAccount !== undefined &&
    !accounts.includes(settings.localDefaultAccount);

  if (hasInvalidDefault) {
    uiLogger.warn(
      commands.account.subcommands.link.events.invalidDefaultAccount(
        settings.localDefaultAccount!
      )
    );
  }

  const initialState: HsSettingsFile = {
    localDefaultAccount: hasInvalidDefault
      ? undefined
      : settings.localDefaultAccount,
    accounts,
  };

  return runAction(initialState, context, args);
}

async function runAction(
  state: HsSettingsFile,
  context: LinkContext,
  args: ArgumentsCamelCase<LinkArgs>
): Promise<ActionResult> {
  const action = await promptForAction(state);
  return (ActionHandlers[action] as ActionHandler)({ state, context, args });
}

async function resolveDefaultAccount({
  accounts,
  currentDefault,
  prompt = '',
}: {
  accounts: number[];
  currentDefault: number | undefined;
  prompt?: string;
}): Promise<number> {
  if (accounts.length === 1) {
    uiLogger.success(
      commands.account.subcommands.link.events.defaultAccountSet(accounts[0])
    );
    return accounts[0];
  }
  return promptForDefaultAccount(accounts, currentDefault, prompt);
}

export async function handleLinkedUseAction({
  state,
  targetAccountId,
}: {
  state: HsSettingsFile;
  targetAccountId?: number;
}): Promise<ActionResult> {
  if (targetAccountId !== undefined) {
    if (state.accounts.includes(targetAccountId)) {
      uiLogger.success(
        commands.account.subcommands.link.events.defaultAccountSet(
          targetAccountId
        )
      );
      return {
        status: ACTION_RESULT_STATUS.SUCCESS,
        settings: {
          accounts: state.accounts,
          localDefaultAccount: targetAccountId,
        },
      };
    }

    const accounts = [...state.accounts, targetAccountId];
    uiLogger.info(commands.account.subcommands.link.events.accountsLinked(1));
    uiLogger.success(
      commands.account.subcommands.link.events.defaultAccountSet(
        targetAccountId
      )
    );
    return {
      status: ACTION_RESULT_STATUS.SUCCESS,
      settings: { accounts, localDefaultAccount: targetAccountId },
    };
  }

  const localDefaultAccount = await resolveDefaultAccount({
    accounts: state.accounts,
    currentDefault: state.localDefaultAccount,
  });
  uiLogger.success(
    commands.account.subcommands.link.events.defaultAccountSet(
      localDefaultAccount
    )
  );
  return {
    status: ACTION_RESULT_STATUS.SUCCESS,
    settings: { accounts: state.accounts, localDefaultAccount },
  };
}

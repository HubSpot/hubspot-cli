import { Argv, ArgumentsCamelCase } from 'yargs';
import { uiLogger } from '../../lib/ui/logger.js';
import { isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';
import { deleteSandbox } from '@hubspot/local-dev-lib/api/sandboxHubs';
import {
  getConfigAccountEnvironment,
  removeAccountFromConfig,
  setConfigAccountAsDefault,
  getAllConfigAccounts,
  getConfigAccountIfExists,
  getConfigDefaultAccountIfExists,
} from '@hubspot/local-dev-lib/config';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { getValidEnv } from '@hubspot/local-dev-lib/environment';
import { logError, debugError } from '../../lib/errorHandlers/index.js';
import { commands } from '../../lang/en.js';
import { deleteSandboxPrompt } from '../../lib/prompts/sandboxesPrompt.js';
import { selectAccountFromConfig } from '../../lib/prompts/accountsPrompt.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { promptUser } from '../../lib/prompts/promptUtils.js';
import { uiAuthCommandReference, uiBetaTag } from '../../lib/ui/index.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  TestingArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsHandlerWithUsageTracking } from '../../lib/yargs/makeYargsHandlerWithUsageTracking.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = 'delete';
const describe = uiBetaTag(commands.sandbox.subcommands.delete.describe, false);

type SandboxDeleteArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs &
  TestingArgs & { account?: string; force?: boolean };

async function handler(
  args: ArgumentsCamelCase<SandboxDeleteArgs>
): Promise<void> {
  const { userProvidedAccount, force, exit } = args;

  let accountPrompt;
  if (!userProvidedAccount) {
    if (!force) {
      accountPrompt = await deleteSandboxPrompt();
    } else {
      // Account is required, throw error if force flag is present and no account is specified
      uiLogger.log('');
      uiLogger.error(commands.sandbox.subcommands.delete.failure.noAccount);
      return exit(EXIT_CODES.ERROR);
    }
    if (!accountPrompt) {
      uiLogger.log('');
      uiLogger.error(
        commands.sandbox.subcommands.delete.failure.noSandboxAccounts
      );
      return exit(EXIT_CODES.ERROR);
    }
  }

  const accountIdentifier = userProvidedAccount || accountPrompt!.account;
  const sandboxAccount = getConfigAccountIfExists(accountIdentifier);

  if (!sandboxAccount) {
    uiLogger.error(
      commands.sandbox.subcommands.delete.failure.noSandboxAccountId
    );
    return exit(EXIT_CODES.ERROR);
  }

  const sandboxAccountId = sandboxAccount.accountId;
  const defaultAccount = getConfigDefaultAccountIfExists();
  const isDefaultAccount = sandboxAccountId === defaultAccount?.accountId;

  const baseUrl = getHubSpotWebsiteOrigin(
    getValidEnv(getConfigAccountEnvironment(sandboxAccountId))
  );

  let parentAccountId;
  const accountsList = getAllConfigAccounts() || [];

  for (const portal of accountsList) {
    if (portal.accountId === sandboxAccountId) {
      if (portal.parentAccountId) {
        parentAccountId = portal.parentAccountId;
      } else if (!force) {
        const parentAccountPrompt = await deleteSandboxPrompt(true);
        if (!parentAccountPrompt) {
          uiLogger.error(
            commands.sandbox.subcommands.delete.failure.noParentAccount
          );
          return exit(EXIT_CODES.ERROR);
        }
        const parentAccount = getConfigAccountIfExists(
          parentAccountPrompt.account
        );
        parentAccountId = parentAccount?.accountId;
      } else {
        uiLogger.error(
          commands.sandbox.subcommands.delete.failure.noParentAccount
        );
        return exit(EXIT_CODES.ERROR);
      }
    }
  }

  const url = `${baseUrl}/sandboxes/${parentAccountId}`;
  const command = uiAuthCommandReference({
    accountId: parentAccountId || undefined,
    qa: getConfigAccountEnvironment(sandboxAccountId) === 'qa',
  });

  if (parentAccountId && !getConfigAccountIfExists(parentAccountId)) {
    uiLogger.log('');
    uiLogger.error(
      commands.sandbox.subcommands.delete.failure.noParentPortalAvailable(
        command,
        url
      )
    );
    uiLogger.log('');
    return exit(EXIT_CODES.ERROR);
  }

  uiLogger.debug(
    commands.sandbox.subcommands.delete.debug.deleting(sandboxAccountId)
  );

  if (isDefaultAccount) {
    uiLogger.info(
      commands.sandbox.subcommands.delete.defaultAccountWarning(
        sandboxAccountId
      )
    );
    uiLogger.log('');
  }

  try {
    if (!force) {
      const { confirmSandboxDeletePrompt: confirmed } = await promptUser([
        {
          name: 'confirmSandboxDeletePrompt',
          type: 'confirm',
          message:
            commands.sandbox.subcommands.delete.confirm(sandboxAccountId),
        },
      ]);
      if (!confirmed) {
        return exit(EXIT_CODES.SUCCESS);
      }
    }

    await deleteSandbox(parentAccountId!, sandboxAccountId);

    uiLogger.log('');
    uiLogger.success(
      isDefaultAccount
        ? commands.sandbox.subcommands.delete.success.deleteDefault(
            userProvidedAccount || accountPrompt!.account,
            sandboxAccountId
          )
        : commands.sandbox.subcommands.delete.success.delete(
            userProvidedAccount || accountPrompt!.account,
            sandboxAccountId
          )
    );
    uiLogger.log('');

    removeAccountFromConfig(sandboxAccountId);

    if (isDefaultAccount && !force) {
      const newDefaultAccount = await selectAccountFromConfig();
      setConfigAccountAsDefault(newDefaultAccount);
    } else if (isDefaultAccount && force) {
      // If force is specified, skip prompt and set the parent account id as the default account
      setConfigAccountAsDefault(parentAccountId!);
    }
    return exit(EXIT_CODES.SUCCESS);
  } catch (err) {
    debugError(err);

    if (isSpecifiedError(err, { statusCode: 401 })) {
      // Intercept invalid key error
      // This command uses the parent portal PAK to delete a sandbox, so we must specify which account needs a new key
      uiLogger.log('');
      uiLogger.error(
        commands.sandbox.subcommands.delete.failure.invalidKey(parentAccountId)
      );
    } else if (
      isSpecifiedError(err, {
        statusCode: 403,
        category: 'BANNED',
        subCategory: 'SandboxErrors.USER_ACCESS_NOT_ALLOWED',
      })
    ) {
      uiLogger.log('');
      uiLogger.error(
        commands.sandbox.subcommands.delete.failure.invalidUser(
          sandboxAccountId,
          parentAccountId!
        )
      );
      uiLogger.log('');
    } else if (
      isSpecifiedError(err, {
        statusCode: 404,
        category: 'OBJECT_NOT_FOUND',
        subCategory: 'SandboxErrors.SANDBOX_NOT_FOUND',
      })
    ) {
      uiLogger.log('');
      uiLogger.warn(
        commands.sandbox.subcommands.delete.failure.objectNotFound(
          sandboxAccountId
        )
      );
      uiLogger.log('');

      removeAccountFromConfig(sandboxAccountId);

      if (isDefaultAccount && !force) {
        const newDefaultAccount = await selectAccountFromConfig();
        setConfigAccountAsDefault(newDefaultAccount);
      } else if (isDefaultAccount) {
        // If force is specified, skip prompt and set the parent account id as the default account
        setConfigAccountAsDefault(parentAccountId!);
      }
      return exit(EXIT_CODES.SUCCESS);
    } else {
      logError(err);
    }
    return exit(EXIT_CODES.ERROR);
  }
}

function sandboxDeleteBuilder(yargs: Argv): Argv<SandboxDeleteArgs> {
  yargs.option('account', {
    describe: commands.sandbox.subcommands.delete.options.account.describe,
    type: 'string',
  });
  yargs.option('force', {
    type: 'boolean',
    alias: 'f',
    describe: commands.sandbox.subcommands.delete.options.force.describe,
  });

  yargs.example([
    [
      '$0 sandbox delete --account=MySandboxAccount',
      commands.sandbox.subcommands.delete.examples.default,
    ],
  ]);

  return yargs as Argv<SandboxDeleteArgs>;
}

const builder = makeYargsBuilder<SandboxDeleteArgs>(
  sandboxDeleteBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
    useTestingOptions: true,
  }
);

const sandboxDeleteCommand: YargsCommandModule<unknown, SandboxDeleteArgs> = {
  command,
  describe,
  handler: makeYargsHandlerWithUsageTracking('sandbox-delete', handler),
  builder,
};

export default sandboxDeleteCommand;

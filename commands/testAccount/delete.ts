import { ArgumentsCamelCase, Argv } from 'yargs';
import {
  fetchDeveloperTestAccounts,
  deleteDeveloperTestAccount,
} from '@hubspot/local-dev-lib/api/developerTestAccounts';
import {
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  TestingArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { commands } from '../../lang/en.js';
import {
  deleteAccount,
  getAccountConfig,
  getAccountId,
  getConfigPath,
  loadConfig,
  updateDefaultAccount,
} from '@hubspot/local-dev-lib/config';
import { promptUser } from '../../lib/prompts/promptUtils.js';
import { PromptChoices } from '../../types/Prompts.js';
import { debugError } from '../../lib/errorHandlers/index.js';
import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';

const command = 'delete [test-account]';
const describe = commands.testAccount.delete.describe;

type DeleteTestAccountArgs = CommonArgs &
  ConfigArgs &
  TestingArgs &
  EnvironmentArgs & {
    testAccount?: string | number;
    force?: boolean;
  };

async function getAccountPromptOptions(
  derivedAccountId: number
): Promise<PromptChoices> {
  try {
    const { data } = await fetchDeveloperTestAccounts(derivedAccountId);

    return data.results.map(testAccount => ({
      name: `${testAccount.accountName} (${testAccount.id})`,
      value: testAccount.id,
    }));
  } catch (err) {
    uiLogger.error(
      commands.testAccount.delete.errors.failedToFetchTestAccounts
    );
    throw err;
  }
}
async function accountToDeleteSelectionPrompt(
  derivedAccountId: number
): Promise<number> {
  const accountData = await getAccountPromptOptions(derivedAccountId);

  if (accountData.length === 0) {
    uiLogger.error(
      commands.testAccount.delete.errors.noAccountsToDelete(derivedAccountId)
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const { testAccountToDelete } = await promptUser<{
    testAccountToDelete: number;
  }>([
    {
      type: 'list',
      name: 'testAccountToDelete',
      pageSize: 20,
      message: commands.testAccount.delete.prompts.selectTestAccounts,
      choices: accountData,
    },
  ]);

  return testAccountToDelete;
}

async function confirmDeletion(): Promise<boolean> {
  const { shouldDelete } = await promptUser<{ shouldDelete: boolean }>([
    {
      type: 'confirm',
      name: 'shouldDelete',
      message: commands.testAccount.delete.prompts.confirmDeletion,
    },
  ]);
  return shouldDelete;
}

async function deleteTestAccountInHubSpot(
  derivedAccountId: number,
  accountId: number
): Promise<void> {
  try {
    await deleteDeveloperTestAccount(derivedAccountId, accountId, true);
    uiLogger.success(
      commands.testAccount.delete.success.testAccountDeletedFromHubSpot(
        accountId
      )
    );
  } catch (e) {
    debugError(e);
    uiLogger.error(
      commands.testAccount.delete.errors.failedToDelete(accountId)
    );
  }
}

async function deleteTestAccountFromConfig(
  testAccountId: number,
  parentAccountName: string,
  account: CLIAccount | null
): Promise<void> {
  try {
    // If the account isn't in the local config then it wasn't auth'd on the local machine
    if (account && account.name && account.accountType) {
      // If the deleted test account was the default account, replace the default account with the parent account
      loadConfig(getConfigPath()!); // Get updated version of the config
      const defaultAccountId = getAccountId(); // We need to get the current default accountId before delete the test account

      await deleteAccount(account.name);

      uiLogger.success(
        commands.testAccount.delete.success.testAccountDeletedFromConfig(
          testAccountId
        )
      );

      if (testAccountId === defaultAccountId) {
        updateDefaultAccount(parentAccountName);
        uiLogger.info(
          commands.testAccount.delete.info.replaceDefaultAccount(
            testAccountId,
            parentAccountName
          )
        );
      }
    }
  } catch (e) {
    debugError(e);
    uiLogger.error(
      commands.testAccount.delete.errors.failedToDeleteFromConfig(testAccountId)
    );
  }
}

async function validateTestAccountConfigs(
  testAccountId: number | null
): Promise<{ testAccountConfig: CLIAccount; parentAccountName: string }> {
  if (!testAccountId) {
    uiLogger.error(
      commands.testAccount.delete.errors.testAccountNotFound(testAccountId)
    );
    process.exit(EXIT_CODES.ERROR);
  }
  const testAccountConfig = getAccountConfig(testAccountId);

  if (!testAccountConfig) {
    uiLogger.error(
      commands.testAccount.delete.errors.testAccountNotFound(testAccountId)
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const parentAccountConfig = getAccountConfig(
    testAccountConfig.parentAccountId!
  );

  if (!parentAccountConfig) {
    uiLogger.error(
      commands.testAccount.delete.errors.parentAccountNotFound(testAccountId)
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const parentAccountName = parentAccountConfig.name!;

  return { testAccountConfig, parentAccountName };
}

async function handler(
  args: ArgumentsCamelCase<DeleteTestAccountArgs>
): Promise<void> {
  const { derivedAccountId, testAccount, force } = args;

  trackCommandUsage('test-account-delete', {}, derivedAccountId);
  let testAccountIdToDelete: number = 0;

  // See if the account exists
  if (testAccount) {
    const accountId = getAccountId(testAccount);
    await validateTestAccountConfigs(accountId);

    if (accountId) {
      testAccountIdToDelete = accountId;
    }
  }

  // Prompt for selection when name or id aren't provided
  if (!testAccountIdToDelete) {
    try {
      testAccountIdToDelete =
        await accountToDeleteSelectionPrompt(derivedAccountId);
    } catch (err) {
      debugError(err);
      uiLogger.error(commands.testAccount.delete.errors.failedToSelectAccount);
      process.exit(EXIT_CODES.ERROR);
    }
  }

  const { testAccountConfig, parentAccountName } =
    await validateTestAccountConfigs(testAccountIdToDelete);

  // If --force, don't prompt user; else confirm deletion
  let shouldDeleteAccount: boolean;
  if (force) {
    shouldDeleteAccount = true;
  } else {
    shouldDeleteAccount = await confirmDeletion();
  }

  if (shouldDeleteAccount) {
    const parentAccountId = testAccountConfig.parentAccountId!;

    await deleteTestAccountInHubSpot(parentAccountId, testAccountIdToDelete);

    await deleteTestAccountFromConfig(
      testAccountIdToDelete,
      parentAccountName,
      testAccountConfig
    );
  } else {
    uiLogger.info(commands.testAccount.delete.info.deletionCanceled);
  }

  process.exit(EXIT_CODES.SUCCESS);
}

function deleteTestAccountBuilder(yargs: Argv): Argv<DeleteTestAccountArgs> {
  yargs.positional('test-account', {
    type: 'string',
    description: commands.testAccount.delete.options.id,
    required: false,
  });
  yargs.option('force', {
    describe: commands.upload.options.force,
    type: 'boolean',
    default: false,
  });
  yargs.example([
    [
      '$0 test-account delete 12345678',
      commands.testAccount.delete.examples.withPositionalID(12345678),
    ],
    [
      '$0 test-account delete my-test-account',
      commands.testAccount.delete.examples.withPositionalName(
        'my-test-account'
      ),
    ],
    [
      '$0 test-account delete --test-account=12345678',
      commands.testAccount.delete.examples.withID(12345678),
    ],
    [
      '$0 test-account delete --test-account=my-test-account',
      commands.testAccount.delete.examples.withName('my-test-account'),
    ],
    ['$0 test-account delete', commands.testAccount.delete.examples.withoutId],
  ]);

  return yargs as Argv<DeleteTestAccountArgs>;
}

const builder = makeYargsBuilder<DeleteTestAccountArgs>(
  deleteTestAccountBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useEnvironmentOptions: true,
    useConfigOptions: true,
    useTestingOptions: true,
  }
);

const deleteTestAccountCommand: YargsCommandModule<
  unknown,
  DeleteTestAccountArgs
> = {
  command,
  describe,
  handler,
  builder,
};

export default deleteTestAccountCommand;

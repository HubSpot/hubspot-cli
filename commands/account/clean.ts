import fs from 'fs';
import { Argv, ArgumentsCamelCase } from 'yargs';
import { accessTokenForPersonalAccessKey } from '@hubspot/local-dev-lib/personalAccessKey';
import {
  loadConfig,
  getConfigPath,
  deleteAccount,
  getConfigAccounts,
  getConfigDefaultAccount,
  updateDefaultAccount,
} from '@hubspot/local-dev-lib/config';
import { getAccountIdentifier } from '@hubspot/local-dev-lib/config/getAccountIdentifier';
import { isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';
import {
  getCWDAccountOverride,
  getDefaultAccountOverrideFilePath,
} from '@hubspot/local-dev-lib/config';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { promptUser } from '../../lib/prompts/promptUtils.js';
import { selectAccountFromConfig } from '../../lib/prompts/accountsPrompt.js';
import { getTableContents } from '../../lib/ui/table.js';
import SpinniesManager from '../../lib/ui/SpinniesManager.js';
import { uiAccountDescription } from '../../lib/ui/index.js';
import {
  CommonArgs,
  ConfigArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';

const command = 'clean';
const describe = commands.account.subcommands.clean.describe;

type AccountCleanArgs = CommonArgs &
  ConfigArgs & {
    qa?: boolean;
  };

async function handler(
  args: ArgumentsCamelCase<AccountCleanArgs>
): Promise<void> {
  const { qa } = args;

  trackCommandUsage('accounts-clean');

  const accountsList = getConfigAccounts() || [];
  const filteredTestAccounts = accountsList.filter(p =>
    qa ? p.env === 'qa' : p.env !== 'qa'
  );

  if (filteredTestAccounts && filteredTestAccounts.length === 0) {
    uiLogger.log(commands.account.subcommands.clean.noResults);
    process.exit(EXIT_CODES.SUCCESS);
  }

  const accountsToRemove = [];
  SpinniesManager.init({
    succeedColor: 'white',
  });
  SpinniesManager.add('accountsClean', {
    text: commands.account.subcommands.clean.loading.add,
  });

  for (const account of filteredTestAccounts) {
    try {
      const accountId = getAccountIdentifier(account);
      await accessTokenForPersonalAccessKey(accountId!, true);
    } catch (error) {
      if (
        isSpecifiedError(error, {
          statusCode: 401,
          category: 'INVALID_AUTHENTICATION',
          subCategory: 'LocalDevAuthErrorType.PORTAL_NOT_ACTIVE',
        }) ||
        isSpecifiedError(error, {
          statusCode: 404,
          category: 'INVALID_AUTHENTICATION',
          subCategory: 'LocalDevAuthErrorType.INVALID_PORTAL_ID',
        })
      ) {
        accountsToRemove.push(account);
      }
    }
  }

  if (accountsToRemove.length > 0) {
    const oneAccountFound = accountsToRemove.length === 1;
    SpinniesManager.succeed('accountsClean', {
      text: oneAccountFound
        ? commands.account.subcommands.clean.inactiveAccountsFound.one
        : commands.account.subcommands.clean.inactiveAccountsFound.other(
            accountsToRemove.length
          ),
    });
    uiLogger.log(
      getTableContents(
        accountsToRemove.map(p => [
          uiAccountDescription(getAccountIdentifier(p)),
        ]),
        { border: { bodyLeft: '  ' } }
      )
    );

    let promptMessage = oneAccountFound
      ? commands.account.subcommands.clean.confirm.one
      : commands.account.subcommands.clean.confirm.other(
          accountsToRemove.length
        );

    const accountOverride = getCWDAccountOverride();
    const overrideFilePath = getDefaultAccountOverrideFilePath();
    const accountOverrideMatches = accountsToRemove.some(
      account =>
        account.name === accountOverride ||
        // @ts-expect-error: Default account override files can only exist with global config
        account.accountId === accountOverride
    );
    if (overrideFilePath && accountOverride && accountOverrideMatches) {
      promptMessage = `${promptMessage}${commands.account.subcommands.clean.defaultAccountOverride(
        overrideFilePath
      )}`;
    }

    const { accountsCleanPrompt } = await promptUser([
      {
        name: 'accountsCleanPrompt',
        type: 'confirm',
        message: promptMessage,
      },
    ]);
    if (accountsCleanPrompt) {
      uiLogger.log('');
      try {
        if (overrideFilePath) {
          fs.unlinkSync(overrideFilePath);
        }
      } catch (error) {
        logError(error);
      }

      for (const accountToRemove of accountsToRemove) {
        await deleteAccount(accountToRemove.name!);
        uiLogger.log(
          commands.account.subcommands.clean.removeSuccess(
            accountToRemove.name!
          )
        );
      }

      // Get updated version of the config
      loadConfig(getConfigPath()!);
      const defaultAccount = getConfigDefaultAccount();

      if (
        defaultAccount &&
        accountsToRemove.some(p => p.name === defaultAccount)
      ) {
        uiLogger.log(commands.account.subcommands.clean.replaceDefaultAccount);
        const newDefaultAccount = await selectAccountFromConfig();
        updateDefaultAccount(newDefaultAccount);
      }
    }
  } else {
    SpinniesManager.succeed('accountsClean', {
      text: commands.account.subcommands.clean.noResults,
    });
  }

  uiLogger.log('');
  process.exit(EXIT_CODES.SUCCESS);
}

function accountCleanBuilder(yargs: Argv): Argv<AccountCleanArgs> {
  yargs.example([['$0 accounts clean']]);

  return yargs as Argv<AccountCleanArgs>;
}

const builder = makeYargsBuilder<AccountCleanArgs>(
  accountCleanBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useTestingOptions: true,
  }
);

const accountCleanCommand: YargsCommandModule<unknown, AccountCleanArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default accountCleanCommand;

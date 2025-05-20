import fs from 'fs';
import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
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
import { trackCommandUsage } from '../../lib/usageTracking';
import { i18n } from '../../lib/lang';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { promptUser } from '../../lib/prompts/promptUtils';
import { selectAccountFromConfig } from '../../lib/prompts/accountsPrompt';
import { getTableContents } from '../../lib/ui/table';
import SpinniesManager from '../../lib/ui/SpinniesManager';
import { uiAccountDescription } from '../../lib/ui';
import { CommonArgs, ConfigArgs, YargsCommandModule } from '../../types/Yargs';
import { logError } from '../../lib/errorHandlers';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const command = 'clean';
const describe = i18n(`commands.account.subcommands.clean.describe`);

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
    logger.log(i18n(`commands.account.subcommands.clean.noResults`));
    process.exit(EXIT_CODES.SUCCESS);
  }

  const accountsToRemove = [];
  SpinniesManager.init({
    succeedColor: 'white',
  });
  SpinniesManager.add('accountsClean', {
    text: i18n(`commands.account.subcommands.clean.loading.add`),
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
      text: i18n(
        oneAccountFound
          ? `commands.account.subcommands.clean.inactiveAccountsFound.one`
          : `commands.account.subcommands.clean.inactiveAccountsFound.other`,
        {
          count: accountsToRemove.length,
        }
      ),
    });
    logger.log(
      getTableContents(
        accountsToRemove.map(p => [
          uiAccountDescription(getAccountIdentifier(p)),
        ]),
        { border: { bodyLeft: '  ' } }
      )
    );

    let promptMessage = i18n(
      oneAccountFound
        ? `commands.account.subcommands.clean.confirm.one`
        : `commands.account.subcommands.clean.confirm.other`,
      {
        count: accountsToRemove.length,
      }
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
      promptMessage = `${promptMessage}${i18n(
        `commands.account.subcommands.clean.defaultAccountOverride`,
        {
          overrideFilePath,
        }
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
      logger.log('');
      try {
        if (overrideFilePath) {
          fs.unlinkSync(overrideFilePath);
        }
      } catch (error) {
        logError(error);
      }

      for (const accountToRemove of accountsToRemove) {
        await deleteAccount(accountToRemove.name!);
        logger.log(
          i18n(`commands.account.subcommands.clean.removeSuccess`, {
            accountName: accountToRemove.name!,
          })
        );
      }

      // Get updated version of the config
      loadConfig(getConfigPath()!);
      const defaultAccount = getConfigDefaultAccount();

      if (
        defaultAccount &&
        accountsToRemove.some(p => p.name === defaultAccount)
      ) {
        logger.log();
        logger.log(
          i18n(`commands.account.subcommands.clean.replaceDefaultAccount`)
        );
        const newDefaultAccount = await selectAccountFromConfig();
        updateDefaultAccount(newDefaultAccount);
      }
    }
  } else {
    SpinniesManager.succeed('accountsClean', {
      text: i18n(`commands.account.subcommands.clean.noResults`),
    });
  }

  logger.log('');
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

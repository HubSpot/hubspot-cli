import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { accessTokenForPersonalAccessKey } from '@hubspot/local-dev-lib/personalAccessKey';
import {
  deleteAccount,
  getConfigAccounts,
} from '@hubspot/local-dev-lib/config';
import { getAccountIdentifier } from '@hubspot/local-dev-lib/config/getAccountIdentifier';
import { isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';
import { trackCommandUsage } from '../../lib/usageTracking';
import { i18n } from '../../lib/lang';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { addTestingOptions, addConfigOptions } from '../../lib/commonOpts';
import { promptUser } from '../../lib/prompts/promptUtils';
import { getTableContents } from '../../lib/ui/table';
import SpinniesManager from '../../lib/ui/SpinniesManager';
import { uiAccountDescription } from '../../lib/ui';
import { CommonArgs, ConfigArgs } from '../../types/Yargs';


export const command = 'clean';
export const describe = i18n(`commands.account.subcommands.clean.describe`);

type AccountCleanArgs = CommonArgs &
  ConfigArgs & {
    qa?: boolean;
  };

export async function handler(
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
    const { accountsCleanPrompt } = await promptUser([
      {
        name: 'accountsCleanPrompt',
        type: 'confirm',
        message: i18n(
          oneAccountFound
            ? `commands.account.subcommands.clean.confirm.one`
            : `commands.account.subcommands.clean.confirm.other`,
          {
            count: accountsToRemove.length,
          }
        ),
      },
    ]);
    if (accountsCleanPrompt) {
      logger.log('');
      for (const accountToRemove of accountsToRemove) {
        await deleteAccount(accountToRemove.name!);
        logger.log(
          i18n(`commands.account.subcommands.clean.removeSuccess`, {
            accountName: accountToRemove.name!,
          })
        );
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

export function builder(yargs: Argv): Argv<AccountCleanArgs> {
  addConfigOptions(yargs);
  addTestingOptions(yargs);

  yargs.example([['$0 accounts clean']]);

  return yargs as Argv<AccountCleanArgs>;
}

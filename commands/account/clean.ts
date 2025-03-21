import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { accessTokenForPersonalAccessKey } from '@hubspot/local-dev-lib/personalAccessKey';
import {
  removeAccountFromConfig,
  getAllConfigAccounts,
} from '@hubspot/local-dev-lib/config';
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

const i18nKey = 'commands.account.subcommands.clean';

export const command = 'clean';
export const describe = i18n(`${i18nKey}.describe`);

type AccountCleanArgs = CommonArgs &
  ConfigArgs & {
    qa?: boolean;
  };

export async function handler(
  args: ArgumentsCamelCase<AccountCleanArgs>
): Promise<void> {
  const { qa } = args;

  trackCommandUsage('accounts-clean');

  const accountsList = getAllConfigAccounts();
  const filteredTestAccounts = accountsList.filter(a =>
    qa ? a.env === 'qa' : a.env !== 'qa'
  );

  if (filteredTestAccounts && filteredTestAccounts.length === 0) {
    logger.log(i18n(`${i18nKey}.noResults`));
    process.exit(EXIT_CODES.SUCCESS);
  }

  const accountsToRemove = [];
  SpinniesManager.init({
    succeedColor: 'white',
  });
  SpinniesManager.add('accountsClean', {
    text: i18n(`${i18nKey}.loading.add`),
  });

  for (const account of filteredTestAccounts) {
    try {
      await accessTokenForPersonalAccessKey(account.accountId, true);
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
          ? `${i18nKey}.inactiveAccountsFound.one`
          : `${i18nKey}.inactiveAccountsFound.other`,
        {
          count: accountsToRemove.length,
        }
      ),
    });
    logger.log(
      getTableContents(
        accountsToRemove.map(a => [uiAccountDescription(a.accountId)]),
        { border: { bodyLeft: '  ' } }
      )
    );
    const { accountsCleanPrompt } = await promptUser([
      {
        name: 'accountsCleanPrompt',
        type: 'confirm',
        message: i18n(
          oneAccountFound
            ? `${i18nKey}.confirm.one`
            : `${i18nKey}.confirm.other`,
          {
            count: accountsToRemove.length,
          }
        ),
      },
    ]);
    if (accountsCleanPrompt) {
      logger.log('');
      for (const accountToRemove of accountsToRemove) {
        await removeAccountFromConfig(accountToRemove.accountId);
        logger.log(
          i18n(`${i18nKey}.removeSuccess`, {
            accountName: accountToRemove.name,
          })
        );
      }
    }
  } else {
    SpinniesManager.succeed('accountsClean', {
      text: i18n(`${i18nKey}.noResults`),
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

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
import { addTestingOptions, addConfigOptions } from '../../lib/commonOpts';
import { promptUser } from '../../lib/prompts/promptUtils';
import { selectAccountFromConfig } from '../../lib/prompts/accountsPrompt';
import { getTableContents } from '../../lib/ui/table';
import SpinniesManager from '../../lib/ui/SpinniesManager';
import { uiAccountDescription } from '../../lib/ui';
import { CommonArgs, ConfigArgs } from '../../types/Yargs';
import { logError } from '../../lib/errorHandlers';

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

  const accountsList = getConfigAccounts() || [];
  const filteredTestAccounts = accountsList.filter(p =>
    qa ? p.env === 'qa' : p.env !== 'qa'
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
          ? `${i18nKey}.inactiveAccountsFound.one`
          : `${i18nKey}.inactiveAccountsFound.other`,
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
      oneAccountFound ? `${i18nKey}.confirm.one` : `${i18nKey}.confirm.other`,
      {
        count: accountsToRemove.length,
      }
    );

    const accountOverride = getCWDAccountOverride();
    const overrideFilePath = getDefaultAccountOverrideFilePath();
    if (overrideFilePath && accountOverride) {
      if (
        accountsToRemove.some(
          account =>
            account.name === accountOverride ||
            // @ts-ignore: Default account override files can only exist with global config
            account.accountId === accountOverride
        )
      ) {
        promptMessage =
          promptMessage +
          i18n(`${i18nKey}.defaultAccountOverride`, {
            overrideFilePath,
          });
      }
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
          i18n(`${i18nKey}.removeSuccess`, {
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
        logger.log(i18n(`${i18nKey}.replaceDefaultAccount`));
        const newDefaultAccount = await selectAccountFromConfig();
        updateDefaultAccount(newDefaultAccount);
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

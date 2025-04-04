import fs from 'fs';
import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  loadConfig,
  getConfigPath,
  deleteAccount,
  getConfigDefaultAccount,
  getAccountId,
  updateDefaultAccount,
  getCWDAccountOverride,
  getDefaultAccountOverrideFilePath,
} from '@hubspot/local-dev-lib/config';

import { trackCommandUsage } from '../../lib/usageTracking';
import { i18n } from '../../lib/lang';
import { promptUser } from '../../lib/prompts/promptUtils';
import { logError } from '../../lib/errorHandlers';
import { selectAccountFromConfig } from '../../lib/prompts/accountsPrompt';
import { addConfigOptions } from '../../lib/commonOpts';
import { CommonArgs, ConfigArgs } from '../../types/Yargs';

const i18nKey = 'commands.account.subcommands.remove';

export const command = 'remove [account]';
export const describe = i18n(`${i18nKey}.describe`);

type AccountRemoveArgs = CommonArgs &
  ConfigArgs & {
    account?: string;
  };

export async function handler(
  args: ArgumentsCamelCase<AccountRemoveArgs>
): Promise<void> {
  const { account } = args;
  let accountToRemove = account;

  if (accountToRemove && !getAccountId(accountToRemove)) {
    logger.error(
      i18n(`${i18nKey}.errors.accountNotFound`, {
        specifiedAccount: accountToRemove,
        configPath: getConfigPath()!,
      })
    );
  }

  if (!accountToRemove || !getAccountId(accountToRemove)) {
    accountToRemove = await selectAccountFromConfig(
      i18n(`${i18nKey}.prompts.selectAccountToRemove`)
    );
  }

  trackCommandUsage(
    'accounts-remove',
    undefined,
    getAccountId(accountToRemove)!
  );

  const currentDefaultAccount = getConfigDefaultAccount();

  const accountOverride = getCWDAccountOverride();
  const overrideFilePath = getDefaultAccountOverrideFilePath();
  if (
    overrideFilePath &&
    accountOverride &&
    accountOverride === accountToRemove
  ) {
    const { deleteOverrideFile } = await promptUser({
      type: 'confirm',
      name: 'deleteOverrideFile',
      message: i18n(`${i18nKey}.prompts.deleteOverrideFile`, {
        overrideFilePath,
        accountName: accountToRemove,
      }),
    });
    try {
      if (deleteOverrideFile) {
        fs.unlinkSync(overrideFilePath);
      }
    } catch (error) {
      logError(error);
    }
  }

  await deleteAccount(accountToRemove);
  logger.success(
    i18n(`${i18nKey}.success.accountRemoved`, {
      accountName: accountToRemove,
    })
  );

  // Get updated version of the config
  loadConfig(getConfigPath()!);

  if (accountToRemove === currentDefaultAccount) {
    logger.log();
    logger.log(i18n(`${i18nKey}.logs.replaceDefaultAccount`));
    const newDefaultAccount = await selectAccountFromConfig();
    updateDefaultAccount(newDefaultAccount);
  }
}

export function builder(yargs: Argv): Argv<AccountRemoveArgs> {
  addConfigOptions(yargs);

  yargs.positional('account', {
    describe: i18n(`${i18nKey}.options.account.describe`),
    type: 'string',
  });

  yargs.example([
    ['$0 accounts remove', i18n(`${i18nKey}.examples.default`)],
    ['$0 accounts remove MyAccount', i18n(`${i18nKey}.examples.byName`)],
  ]);

  return yargs as Argv<AccountRemoveArgs>;
}

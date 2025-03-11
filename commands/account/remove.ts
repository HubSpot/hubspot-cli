import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  getConfigFilePath,
  removeAccountFromConfig,
  getConfigDefaultAccount,
  setConfigAccountAsDefault,
  getConfigAccountIfExists,
} from '@hubspot/local-dev-lib/config';
import { trackCommandUsage } from '../../lib/usageTracking';
import { i18n } from '../../lib/lang';
import { selectAccountFromConfig } from '../../lib/prompts/accountsPrompt';
import { addConfigOptions } from '../../lib/commonOpts';
import { CommonArgs, ConfigArgs } from '../../types/Yargs';
import { EXIT_CODES } from '../../lib/enums/exitCodes';

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
  const { account: accountArg } = args;
  let accountToRemoveIdentifier = accountArg;

  if (!accountToRemoveIdentifier) {
    accountToRemoveIdentifier = await selectAccountFromConfig(
      i18n(`${i18nKey}.prompts.selectAccountToRemove`)
    );
  }

  const account = getConfigAccountIfExists(accountToRemoveIdentifier);

  if (!account) {
    logger.error(
      i18n(`${i18nKey}.errors.accountNotFound`, {
        specifiedAccount: accountToRemoveIdentifier,
        configPath: getConfigFilePath(),
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  trackCommandUsage('accounts-remove', undefined, account.accountId);

  const currentDefaultAccount = getConfigDefaultAccount();

  await removeAccountFromConfig(account.accountId);
  logger.success(
    i18n(`${i18nKey}.success.accountRemoved`, {
      accountName: accountToRemoveIdentifier,
    })
  );

  if (account.accountId === currentDefaultAccount.accountId) {
    logger.log();
    logger.log(i18n(`${i18nKey}.logs.replaceDefaultAccount`));
    const newDefaultAccount = await selectAccountFromConfig();
    setConfigAccountAsDefault(newDefaultAccount);
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

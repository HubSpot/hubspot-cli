import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { getAccessToken } from '@hubspot/local-dev-lib/personalAccessKey';
import { makeYargsBuilder } from '../../lib/commonOpts';
import { i18n } from '../../lib/lang';
import { getTableContents } from '../../lib/ui/table';
import { CommonArgs, ConfigArgs } from '../../types/Yargs';

const i18nKey = 'commands.account.subcommands.info';

export const describe = i18n(`${i18nKey}.describe`);
export const command = 'info [account]';

type AccountInfoArgs = CommonArgs & ConfigArgs;

export async function handler(
  args: ArgumentsCamelCase<AccountInfoArgs>
): Promise<void> {
  const { derivedAccountId } = args;
  const config = getAccountConfig(derivedAccountId);
  // check if the provided account is using a personal access key, if not, show an error
  if (config && config.authType === 'personalaccesskey') {
    const { name, personalAccessKey, env } = config;
    let scopeGroups: string[][] = [];

    const response = await getAccessToken(
      personalAccessKey!,
      env,
      derivedAccountId
    );

    scopeGroups = response.scopeGroups.map(s => [s]);

    logger.log(i18n(`${i18nKey}.name`, { name: name! }));
    logger.log(i18n(`${i18nKey}.accountId`, { accountId: derivedAccountId }));
    logger.log(i18n(`${i18nKey}.scopeGroups`));
    logger.log(getTableContents(scopeGroups, { border: { bodyLeft: '  ' } }));
  } else {
    logger.log(i18n(`${i18nKey}.errors.notUsingPersonalAccessKey`));
  }
}

function accountInfoBuilder(yargs: Argv): Argv<AccountInfoArgs> {
  yargs.positional('account', {
    describe: i18n(`${i18nKey}.options.account.describe`),
    type: 'string',
  });

  yargs.example([
    ['$0 accounts info', i18n(`${i18nKey}.examples.default`)],
    ['$0 accounts info MyAccount', i18n(`${i18nKey}.examples.nameBased`)],
    ['$0 accounts info 1234567', i18n(`${i18nKey}.examples.idBased`)],
  ]);

  return yargs as Argv<AccountInfoArgs>;
}

export const builder = makeYargsBuilder<AccountInfoArgs>(
  accountInfoBuilder,
  command,
  describe,
  { useConfigOptions: true }
);

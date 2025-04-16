import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  getAccountConfig,
  getDisplayDefaultAccount,
  getConfigDefaultAccount,
  getDefaultAccountOverrideFilePath,
  getConfigPath,
} from '@hubspot/local-dev-lib/config';
import { getAccessToken } from '@hubspot/local-dev-lib/personalAccessKey';
import { makeYargsBuilder } from '../../lib/yargsUtils';
import { i18n } from '../../lib/lang';
import { indent } from '../../lib/ui/index';
import { getTableContents } from '../../lib/ui/table';
import { CommonArgs, ConfigArgs } from '../../types/Yargs';

export const describe = i18n(`commands.account.subcommands.info.describe`);
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

    // If a default account is present in the config, display it
    const configPath = getConfigPath();
    if (configPath) {
      logger.log(i18n(`commands.account.subcommands.info.defaultAccountTitle`));
      logger.log(
        `${indent(1)}${i18n(`commands.account.subcommands.info.configPath`, {
          configPath,
        })}`
      );
      logger.log(
        `${indent(1)}${i18n(
          `commands.account.subcommands.info.defaultAccount`,
          {
            account: getDisplayDefaultAccount()!,
          }
        )}`
      );
    }

    // If a default account override is present, display it
    const overrideFilePath = getDefaultAccountOverrideFilePath();
    if (overrideFilePath) {
      logger.log('');
      logger.log(
        i18n(`commands.account.subcommands.info.overrideFilePathTitle`)
      );
      logger.log(
        `${indent(1)}${i18n(`commands.account.subcommands.info.overrideFilePath`, { overrideFilePath })}`
      );
      logger.log(
        `${indent(1)}${i18n(
          `commands.account.subcommands.info.overrideAccount`,
          {
            account: getConfigDefaultAccount()!,
          }
        )}`
      );
    }

    logger.log('');
    logger.log(i18n(`commands.account.subcommands.info.name`, { name: name! }));
    logger.log(
      i18n(`commands.account.subcommands.info.accountId`, {
        accountId: derivedAccountId,
      })
    );
    logger.log(i18n(`commands.account.subcommands.info.scopeGroups`));
    logger.log(getTableContents(scopeGroups, { border: { bodyLeft: '  ' } }));
  } else {
    logger.log(
      i18n(`commands.account.subcommands.info.errors.notUsingPersonalAccessKey`)
    );
  }
}

function accountInfoBuilder(yargs: Argv): Argv<AccountInfoArgs> {
  yargs.positional('account', {
    describe: i18n(
      `commands.account.subcommands.info.options.account.describe`
    ),
    type: 'string',
  });

  yargs.example([
    [
      '$0 accounts info',
      i18n(`commands.account.subcommands.info.examples.default`),
    ],
    [
      '$0 accounts info MyAccount',
      i18n(`commands.account.subcommands.info.examples.nameBased`),
    ],
    [
      '$0 accounts info 1234567',
      i18n(`commands.account.subcommands.info.examples.idBased`),
    ],
  ]);

  return yargs as Argv<AccountInfoArgs>;
}

export const builder = makeYargsBuilder<AccountInfoArgs>(
  accountInfoBuilder,
  command,
  describe,
  { useConfigOptions: true }
);

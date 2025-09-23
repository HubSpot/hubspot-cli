import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  getAccountConfig,
  getDisplayDefaultAccount,
  getConfigDefaultAccount,
  getDefaultAccountOverrideFilePath,
  getConfigPath,
} from '@hubspot/local-dev-lib/config';
import { getAccessToken } from '@hubspot/local-dev-lib/personalAccessKey';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { indent } from '../../lib/ui/index.js';
import { getTableContents } from '../../lib/ui/table.js';
import {
  CommonArgs,
  ConfigArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';

const describe = commands.account.subcommands.info.describe;
const command = 'info [account]';

type AccountInfoArgs = CommonArgs & ConfigArgs;

async function handler(
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
      uiLogger.log(commands.account.subcommands.info.defaultAccountTitle);
      uiLogger.log(
        `${indent(1)}${commands.account.subcommands.info.configPath(
          configPath
        )}`
      );
      uiLogger.log(
        `${indent(1)}${commands.account.subcommands.info.defaultAccount(
          getDisplayDefaultAccount()!.toString()
        )}`
      );
    }

    // If a default account override is present, display it
    const overrideFilePath = getDefaultAccountOverrideFilePath();
    if (overrideFilePath) {
      uiLogger.log('');
      uiLogger.log(commands.account.subcommands.info.overrideFilePathTitle);
      uiLogger.log(
        `${indent(1)}${commands.account.subcommands.info.overrideFilePath(overrideFilePath)}`
      );
      uiLogger.log(
        `${indent(1)}${commands.account.subcommands.info.overrideAccount(
          getConfigDefaultAccount()!.toString()
        )}`
      );
    }

    uiLogger.log('');
    uiLogger.log(commands.account.subcommands.info.name(name!));
    uiLogger.log(commands.account.subcommands.info.accountId(derivedAccountId));
    uiLogger.log(commands.account.subcommands.info.scopeGroups);
    uiLogger.log(getTableContents(scopeGroups, { border: { bodyLeft: '  ' } }));
  } else {
    uiLogger.log(
      commands.account.subcommands.info.errors.notUsingPersonalAccessKey
    );
  }
}

function accountInfoBuilder(yargs: Argv): Argv<AccountInfoArgs> {
  yargs.positional('account', {
    describe: commands.account.subcommands.info.options.account.describe,
    type: 'string',
  });

  yargs.example([
    ['$0 accounts info', commands.account.subcommands.info.examples.default],
    [
      '$0 accounts info MyAccount',
      commands.account.subcommands.info.examples.nameBased,
    ],
    [
      '$0 accounts info 1234567',
      commands.account.subcommands.info.examples.idBased,
    ],
  ]);

  return yargs as Argv<AccountInfoArgs>;
}

const builder = makeYargsBuilder<AccountInfoArgs>(
  accountInfoBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
  }
);

const accountInfoCommand: YargsCommandModule<unknown, AccountInfoArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default accountInfoCommand;

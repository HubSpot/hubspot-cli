import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  getConfigAccountById,
  getConfigDefaultAccount,
  getConfigFilePath,
} from '@hubspot/local-dev-lib/config';
import { getDefaultAccountOverrideFilePath } from '@hubspot/local-dev-lib/config/defaultAccountOverride';
import {
  getHsSettingsFileIfExists,
  getHsSettingsFilePath,
} from '@hubspot/local-dev-lib/config/hsSettings';
import { isDirectoryLinked } from '../../lib/link/linkUtils.js';
import { getAccessToken } from '@hubspot/local-dev-lib/personalAccessKey';
import { uiAccountDescription } from '../../lib/ui/index.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { indent } from '../../lib/ui/index.js';
import {
  CommonArgs,
  ConfigArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsHandlerWithUsageTracking } from '../../lib/yargs/makeYargsHandlerWithUsageTracking.js';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { renderList } from '../../ui/render.js';

const describe = commands.account.subcommands.info.describe;
const command = 'info [account]';

type AccountInfoArgs = CommonArgs & ConfigArgs;

function logLinkedAccountInfo(
  hsSettingsPath: string,
  localDefaultAccount: number | undefined
): void {
  uiLogger.log(commands.account.subcommands.info.linkedDefaultTitle);
  uiLogger.log(
    `${indent(1)}${commands.account.subcommands.info.settingsPath(hsSettingsPath)}`
  );
  if (localDefaultAccount) {
    uiLogger.log(
      `${indent(1)}${commands.account.subcommands.info.linkedDefault(uiAccountDescription(localDefaultAccount))}`
    );
  }
}

function logGlobalAccountInfo(): void {
  const configPath = getConfigFilePath();
  if (configPath) {
    uiLogger.log(commands.account.subcommands.info.defaultAccountTitle);
    uiLogger.log(
      `${indent(1)}${commands.account.subcommands.info.configPath(configPath)}`
    );
    const defaultAccount = getConfigDefaultAccount();
    uiLogger.log(
      `${indent(1)}${commands.account.subcommands.info.defaultAccount(defaultAccount.name)}`
    );
  }

  const overrideFilePath = getDefaultAccountOverrideFilePath();
  if (overrideFilePath) {
    uiLogger.log('');
    uiLogger.log(commands.account.subcommands.info.overrideFilePathTitle);
    uiLogger.log(
      `${indent(1)}${commands.account.subcommands.info.overrideFilePath(overrideFilePath)}`
    );
    const defaultAccount = getConfigDefaultAccount();
    uiLogger.log(
      `${indent(1)}${commands.account.subcommands.info.overrideAccount(defaultAccount.name)}`
    );
  }
}

async function handler(
  args: ArgumentsCamelCase<AccountInfoArgs>
): Promise<void> {
  const { derivedAccountId } = args;
  const config = getConfigAccountById(derivedAccountId);
  if (config && config.authType === 'personalaccesskey') {
    const { name, personalAccessKey, env } = config;
    let scopeGroups: string[][] = [];

    const response = await getAccessToken(
      personalAccessKey!,
      env,
      derivedAccountId
    );

    scopeGroups = response.scopeGroups.map(s => [s]);

    const hsSettings = getHsSettingsFileIfExists();
    const hsSettingsPath = getHsSettingsFilePath();
    const isLinked = isDirectoryLinked(hsSettings) && hsSettingsPath !== null;

    if (isLinked) {
      logLinkedAccountInfo(hsSettingsPath, hsSettings.localDefaultAccount);
    } else {
      logGlobalAccountInfo();
    }

    uiLogger.log('');
    uiLogger.log(commands.account.subcommands.info.name(name!));
    uiLogger.log(commands.account.subcommands.info.accountId(derivedAccountId));
    uiLogger.log(commands.account.subcommands.info.scopeGroups);
    renderList(scopeGroups);
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
  handler: makeYargsHandlerWithUsageTracking('account-info', handler),
  builder,
};

export default accountInfoCommand;

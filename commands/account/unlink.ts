import { YargsCommandModule } from '../../types/Yargs.js';
import { ArgumentsCamelCase, Argv } from 'yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { getAllConfigAccounts } from '@hubspot/local-dev-lib/config';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import {
  getHsSettingsFileIfExists,
  getHsSettingsFilePath,
} from '@hubspot/local-dev-lib/config/hsSettings';
import { ACTION_RESULT_STATUS, LinkArgs } from '../../types/Link.js';
import { ActionHandlers } from '../../lib/link/index.js';
import {
  hasDeprecatedConfigConflict,
  isDirectoryLinked,
  writeLinkedSettings,
} from '../../lib/link/linkUtils.js';
import { commands } from '../../lang/en.js';
import { DEFAULT_HS_SETTINGS_PATH } from '@hubspot/local-dev-lib/constants/config';
import { makeYargsHandlerWithUsageTracking } from '../../lib/yargs/makeYargsHandlerWithUsageTracking.js';

const command = 'unlink';
// Hide the command until we're done testing and ready to make linking GA
// const describe = commands.account.subcommands.link.describe;
const describe = undefined;

async function handler(args: ArgumentsCamelCase<LinkArgs>): Promise<void> {
  const { exit } = args;

  if (hasDeprecatedConfigConflict(args._)) {
    return exit(EXIT_CODES.ERROR);
  }

  const existingSettings = getHsSettingsFileIfExists();

  if (!isDirectoryLinked(existingSettings)) {
    const globalAccounts = getAllConfigAccounts();
    uiLogger.log(commands.account.subcommands.link.shared.noLinkedAccounts);
    uiLogger.log(
      commands.account.subcommands.link.shared.globalAccountsAvailable(
        globalAccounts.length
      )
    );
    uiLogger.log('');
    uiLogger.log(commands.account.subcommands.link.shared.configurePrompt);
    return exit(EXIT_CODES.SUCCESS);
  }

  uiLogger.log(
    commands.account.subcommands.link.managingLinkedAccounts(getCwd())
  );
  uiLogger.log('');

  const result = await ActionHandlers.unlink({
    state: existingSettings,
    context: {
      globalAccountsList: getAllConfigAccounts(),
      globalDefaultAccount: undefined,
      accountOverrideId: null,
    },
    args,
  });

  if (result.status === ACTION_RESULT_STATUS.ERROR) {
    uiLogger.error(result.reason);
    return exit(EXIT_CODES.ERROR);
  }
  if (result.status === ACTION_RESULT_STATUS.NOOP) {
    return exit(EXIT_CODES.SUCCESS);
  }

  const settingsPath = getHsSettingsFilePath() || DEFAULT_HS_SETTINGS_PATH;

  if (!writeLinkedSettings(result.settings, settingsPath)) {
    return exit(EXIT_CODES.ERROR);
  }

  uiLogger.success(
    commands.account.subcommands.link.shared.savedToSettings(settingsPath)
  );

  return exit(EXIT_CODES.SUCCESS);
}

function unlinkBuilder(yargs: Argv): Argv<LinkArgs> {
  yargs.example([['$0 account unlink']]);
  return yargs as Argv<LinkArgs>;
}

const builder = makeYargsBuilder<LinkArgs>(
  unlinkBuilder,
  command,
  commands.account.subcommands.unlink.verboseDescribe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
  }
);

const unlinkCommand: YargsCommandModule<unknown, LinkArgs> = {
  command,
  describe,
  handler: makeYargsHandlerWithUsageTracking('account-unlink', handler),
  builder,
};

export default unlinkCommand;

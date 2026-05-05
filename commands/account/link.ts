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
import { getDefaultAccountOverrideAccountId } from '@hubspot/local-dev-lib/config/defaultAccountOverride';
import { checkAndAddHsFolderToGitignore } from '@hubspot/local-dev-lib/gitignore';
import {
  DEFAULT_HS_SETTINGS_PATH,
  EMPTY_HS_SETTINGS_FILE,
} from '@hubspot/local-dev-lib/constants/config';
import { ACTION_RESULT_STATUS, LinkArgs } from '../../types/Link.js';
import { handleLinkFlow } from '../../lib/link/index.js';
import {
  hasDeprecatedConfigConflict,
  writeLinkedSettings,
} from '../../lib/link/linkUtils.js';
import { renderLinkedAccountsTable } from '../../lib/link/renderLinkedAccountsTable.js';
import { commands } from '../../lang/en.js';
import { debugError } from '../../lib/errorHandlers/index.js';
import { makeYargsHandlerWithUsageTracking } from '../../lib/yargs/makeYargsHandlerWithUsageTracking.js';

const command = 'link';
// Hide the command until we're done testing and ready to make linking GA
// const describe = commands.account.subcommands.link.describe;
const describe = undefined;

async function handler(args: ArgumentsCamelCase<LinkArgs>): Promise<void> {
  const { exit } = args;

  if (hasDeprecatedConfigConflict(args._)) {
    return exit(EXIT_CODES.ERROR);
  }

  const existingSettings = getHsSettingsFileIfExists();
  const isNewFile = existingSettings === null;

  if (isNewFile) {
    uiLogger.log(commands.account.subcommands.link.linkingDirectory(getCwd()));
  } else {
    uiLogger.log(
      commands.account.subcommands.link.managingLinkedAccounts(getCwd())
    );
  }
  uiLogger.log('');

  const settingsFilePath = getHsSettingsFilePath() || DEFAULT_HS_SETTINGS_PATH;
  uiLogger.log(
    commands.account.subcommands.link.settingsInfo(settingsFilePath)
  );
  uiLogger.log('');

  const settings = isNewFile ? EMPTY_HS_SETTINGS_FILE : existingSettings;

  const accounts = getAllConfigAccounts();
  const accountOverrideId = getDefaultAccountOverrideAccountId(accounts);

  if (settings.accounts.length !== 0) {
    await renderLinkedAccountsTable(settings);
    uiLogger.log('');
  }

  const result = await handleLinkFlow({
    settings,
    accountOverrideId,
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

  try {
    checkAndAddHsFolderToGitignore(settingsPath);
  } catch (e) {
    debugError(e);
  }

  if (isNewFile) {
    uiLogger.success(
      commands.account.subcommands.link.success.created(settingsPath)
    );
  } else {
    uiLogger.success(
      commands.account.subcommands.link.shared.savedToSettings(settingsPath)
    );
  }

  return exit(EXIT_CODES.SUCCESS);
}

function linkBuilder(yargs: Argv): Argv<LinkArgs> {
  yargs.example([['$0 link']]);

  return yargs as Argv<LinkArgs>;
}

const builder = makeYargsBuilder<LinkArgs>(
  linkBuilder,
  command,
  commands.account.subcommands.link.verboseDescribe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
  }
);

const linkCommand: YargsCommandModule<unknown, LinkArgs> = {
  command,
  describe,
  handler: makeYargsHandlerWithUsageTracking('account-link', handler),
  builder,
};

export default linkCommand;

import chalk from 'chalk';
import yargsParser from 'yargs-parser';
import { Argv, Arguments } from 'yargs';
import { LOG_LEVEL, logger, setLogLevel } from '@hubspot/local-dev-lib/logger';
import {
  DEFAULT_CMS_PUBLISH_MODE,
  CMS_PUBLISH_MODE,
} from '@hubspot/local-dev-lib/constants/files';
import { CmsPublishMode } from '@hubspot/local-dev-lib/types/Files';
import {
  getAccountConfig,
  getAndLoadConfigIfNeeded,
} from '@hubspot/local-dev-lib/config';
import { ConfigArgs, StringArgType } from '../types/Yargs.js';
import { debugError } from './errorHandlers/index.js';
import { EXIT_CODES } from './enums/exitCodes.js';
import { uiCommandReference } from './ui/index.js';
import { i18n } from './lang.js';
import { getTerminalUISupport, UI_COLORS } from './ui/index.js';
import SpinniesManager from './ui/SpinniesManager.js';

export function addGlobalOptions(yargs: Argv) {
  yargs.version(false);
  yargs.option('debug', {
    alias: 'd',
    default: false,
    describe: i18n('lib.commonOpts.options.debug.describe'),
    type: 'boolean',
  });
  yargs.option('network-debug', {
    default: false,
    type: 'boolean',
    hidden: true,
  });
  return yargs;
}

export function addAccountOptions(yargs: Argv): Argv {
  return yargs.option('account', {
    alias: 'a',
    describe: i18n('lib.commonOpts.options.account.describe'),
    type: 'string',
  });
}

export function addConfigOptions(yargs: Argv): Argv<ConfigArgs> {
  return yargs.option<keyof ConfigArgs, StringArgType>('config', {
    alias: 'c',
    describe: i18n('lib.commonOpts.options.config.describe'),
    type: 'string',
  });
}

export function addOverwriteOptions(yargs: Argv): Argv {
  return yargs.option('overwrite', {
    alias: 'o',
    describe: i18n('lib.commonOpts.options.overwrite.describe'),
    type: 'boolean',
    default: false,
  });
}

export function addCmsPublishModeOptions(
  yargs: Argv,
  { read, write }: { read?: boolean; write?: boolean }
): Argv {
  const cmsPublishModes = `<${Object.values(CMS_PUBLISH_MODE).join(' | ')}>`;

  return yargs.option('cms-publish-mode', {
    alias: 'm',
    describe: i18n(
      `lib.commonOpts.options.modes.describe.${
        read ? 'read' : write ? 'write' : 'default'
      }`,
      { modes: cmsPublishModes }
    ),
    type: 'string',
  });
}

export function addTestingOptions(yargs: Argv): Argv {
  return yargs.option('qa', {
    describe: i18n('lib.commonOpts.options.qa.describe'),
    type: 'boolean',
    default: false,
    hidden: true,
  });
}

export function addUseEnvironmentOptions(yargs: Argv): Argv {
  yargs.option('use-env', {
    describe: i18n('lib.commonOpts.options.useEnv.describe'),
    type: 'boolean',
  });
  yargs.conflicts('use-env', 'account');
  return yargs;
}

export function addJSONOutputOptions(yargs: Argv): Argv {
  return yargs.option('json', {
    alias: 'format-output-as-json',
    describe: i18n('lib.commonOpts.options.jsonOutput.describe'),
    type: 'boolean',
    hidden: true,
  });
}

// Remove this once we've upgraded to yargs 18.0.0
function uiBetaTagWithColor(message: string): string {
  const terminalUISupport = getTerminalUISupport();
  const tag = i18n(`lib.ui.betaTagWithStyle`);

  const result = `${
    terminalUISupport.color ? chalk.hex(UI_COLORS.SORBET)(tag) : tag
  } ${message}`;

  return result;
}

// Remove this once we've upgraded to yargs 18.0.0
function uiDeprecatedTagWithColor(message: string): string {
  const terminalUISupport = getTerminalUISupport();
  const tag = i18n(`lib.ui.deprecatedTagWithStyle`);

  const result = `${
    terminalUISupport.color ? chalk.yellow(tag) : tag
  } ${message}`;

  return result;
}

export async function addCustomHelpOutput(
  yargs: Argv,
  command: string | string[],
  describe?: string
): Promise<void> {
  try {
    // Remove this once we've upgraded to yargs 18.0.0
    if (describe && describe.includes(i18n(`lib.ui.betaTag`))) {
      describe = describe.replace(i18n(`lib.ui.betaTag`) + ' ', '');
      describe = uiBetaTagWithColor(describe);
    }
    // Remove this once we've upgraded to yargs 18.0.0
    if (describe && describe.includes(i18n(`lib.ui.deprecatedTag`))) {
      describe = describe.replace(i18n(`lib.ui.deprecatedTag`) + ' ', '');
      describe = uiDeprecatedTagWithColor(describe);
    }

    const parsedArgv = yargsParser(process.argv.slice(2));

    if (parsedArgv && parsedArgv.help) {
      const commandBase = `hs ${parsedArgv._.slice(0, -1).join(' ')}`;

      // Make sure we are targeting the correct command by confirming that
      // "command" matches the last part of the user's input command
      const checkIsTargetCommand = (command: string) => {
        const targetBaseCommand = command.split(' ')[0];
        return targetBaseCommand === parsedArgv._[parsedArgv._.length - 1];
      };

      const isTargetedCommand = Array.isArray(command)
        ? command.some(checkIsTargetCommand)
        : checkIsTargetCommand(command);

      if (!isTargetedCommand) {
        return;
      }

      // Construct the full command, including positional arguments
      const commandString = Array.isArray(command) ? command[0] : command;
      const fullCommand = `${commandBase.trim()} ${commandString}`;

      // Format the original help output to be more readable
      let commandHelp = await yargs.getHelp();
      ['Options:', 'Commands:', 'Examples:', 'Positionals:'].forEach(header => {
        commandHelp = commandHelp.replace(header, chalk.bold(header));
      });

      // Remove "hs <command>" from the help output (this shows up for command buckets)
      commandHelp = commandHelp.replace('hs <command>\n', '');

      // Remove the first line of the help output if it's empty
      if (commandHelp.startsWith('\n')) {
        commandHelp = commandHelp.slice(1);
      }

      logger.log(
        `${uiCommandReference(fullCommand, false)}\n\n${
          describe ? `${describe}\n\n` : ''
        }${commandHelp}`
      );
      process.exit(EXIT_CODES.SUCCESS);
    }
  } catch (e) {
    // Ignore error to allow yargs to show the default help output using the command description
    debugError(e);
  }
}

export function setCLILogLevel(
  options: Arguments<{
    debug?: boolean;
    networkDebug?: boolean;
    json?: boolean;
  }>
): void {
  const { debug, networkDebug, json } = options;
  if (json) {
    setLogLevel(LOG_LEVEL.ERROR);
    SpinniesManager.setDisableOutput(true);
  } else if (debug) {
    setLogLevel(LOG_LEVEL.DEBUG);
  } else {
    setLogLevel(LOG_LEVEL.LOG);
  }

  if (networkDebug) {
    process.env.HUBSPOT_NETWORK_LOGGING = 'true';
    setLogLevel(LOG_LEVEL.DEBUG);
  }
}

export function getCommandName(argv: Arguments): string {
  return String(argv && argv._ && argv._[0]) || '';
}

export function getCmsPublishMode(
  options: Arguments<{
    cmsPublishMode?: CmsPublishMode;
    derivedAccountId?: number;
  }>
): CmsPublishMode {
  // 1. --cmsPublishMode
  const { cmsPublishMode } = options;
  if (cmsPublishMode && typeof cmsPublishMode === 'string') {
    return cmsPublishMode.toLowerCase() as CmsPublishMode;
  }
  // 2. config[account].defaultCmsPublishMode
  if (options.derivedAccountId) {
    const accountConfig = getAccountConfig(options.derivedAccountId);
    if (accountConfig && accountConfig.defaultCmsPublishMode) {
      return accountConfig.defaultCmsPublishMode;
    }
  }
  // 3. config.defaultCmsPublishMode
  // 4. DEFAULT_CMS_PUBLISH_MODE
  const config = getAndLoadConfigIfNeeded();
  return (
    (config && (config.defaultCmsPublishMode as CmsPublishMode)) ||
    DEFAULT_CMS_PUBLISH_MODE
  );
}

import chalk from 'chalk';
import yargsParser from 'yargs-parser';
import { Argv, Arguments } from 'yargs';
import {
  LOG_LEVEL,
  logger,
  setLogLevel as setLoggerLogLevel,
} from '@hubspot/local-dev-lib/logger';
import {
  DEFAULT_CMS_PUBLISH_MODE,
  CMS_PUBLISH_MODE,
} from '@hubspot/local-dev-lib/constants/files';
import { CmsPublishMode } from '@hubspot/local-dev-lib/types/Files';
import {
  getAccountConfig,
  getAndLoadConfigIfNeeded,
} from '@hubspot/local-dev-lib/config';
import { i18n } from './lang';
import { ConfigArgs, StringArgType } from '../types/Yargs';
import { debugError } from './errorHandlers';
import { EXIT_CODES } from './enums/exitCodes';
import { uiCommandReference } from './ui';

export function addGlobalOptions(yargs: Argv) {
  yargs.version(false);
  yargs.option('debug', {
    alias: 'd',
    default: false,
    describe: i18n(`lib.commonOpts.options.debug.describe`),
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
    describe: i18n(`lib.commonOpts.options.account.describe`),
    type: 'string',
  });
}

export function addConfigOptions(yargs: Argv): Argv<ConfigArgs> {
  return yargs.option<keyof ConfigArgs, StringArgType>('config', {
    alias: 'c',
    describe: i18n(`lib.commonOpts.options.config.describe`),
    type: 'string',
  });
}

export function addOverwriteOptions(yargs: Argv): Argv {
  return yargs.option('overwrite', {
    alias: 'o',
    describe: i18n(`lib.commonOpts.options.overwrite.describe`),
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
    describe: i18n(`lib.commonOpts.options.qa.describe`),
    type: 'boolean',
    default: false,
    hidden: true,
  });
}

export function addUseEnvironmentOptions(yargs: Argv): Argv {
  yargs.option('use-env', {
    describe: i18n(`lib.commonOpts.options.useEnv.describe`),
    type: 'boolean',
  });
  yargs.conflicts('use-env', 'account');
  return yargs;
}

export async function addCustomHelpOutput(
  yargs: Argv,
  command: string | string[],
  describe?: string
): Promise<void> {
  try {
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

export function setLogLevel(
  options: Arguments<{ debug?: boolean; networkDebug?: boolean }>
): void {
  const { debug, networkDebug } = options;
  if (debug) {
    setLoggerLogLevel(LOG_LEVEL.DEBUG);
  } else {
    setLoggerLogLevel(LOG_LEVEL.LOG);
  }

  if (networkDebug) {
    process.env.HUBSPOT_NETWORK_LOGGING = 'true';
    setLoggerLogLevel(LOG_LEVEL.DEBUG);
  }
}

export function getCommandName(argv: Arguments<{ _?: string[] }>): string {
  return (argv && argv._ && argv._[0]) || '';
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

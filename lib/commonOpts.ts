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

const i18nKey = 'lib.commonOpts';

export function makeYargsBuilder<T>(
  callback: (yargs: Argv) => Argv<T>,
  command: string,
  describe: string,
  options: {
    useGlobalOptions?: boolean;
    useAccountOptions?: boolean;
    useConfigOptions?: boolean;
    useUseEnvironmentOptions?: boolean;
    useTestingOptions?: boolean;
  }
): (yargs: Argv) => Promise<Argv<T>> {
  return async function (yargs: Argv): Promise<Argv<T>> {
    if (options.useGlobalOptions) {
      addGlobalOptions(yargs);
    }
    if (options.useAccountOptions) {
      addAccountOptions(yargs);
    }
    if (options.useConfigOptions) {
      addConfigOptions(yargs);
    }
    if (options.useUseEnvironmentOptions) {
      addUseEnvironmentOptions(yargs);
    }
    if (options.useTestingOptions) {
      addTestingOptions(yargs);
    }

    const result = callback(yargs);

    // Must go last to pick up available options
    await addCustomHelpOutput(result, command, describe);

    return result;
  };
}

export function addGlobalOptions(yargs: Argv) {
  yargs.version(false);

  return yargs.option('debug', {
    alias: 'd',
    default: false,
    describe: i18n(`${i18nKey}.options.debug.describe`),
    type: 'boolean',
  });
}

export function addAccountOptions(yargs: Argv): Argv {
  return yargs.option('account', {
    alias: 'a',
    describe: i18n(`${i18nKey}.options.account.describe`),
    type: 'string',
  });
}

export function addConfigOptions(yargs: Argv): Argv<ConfigArgs> {
  return yargs.option<keyof ConfigArgs, StringArgType>('config', {
    alias: 'c',
    describe: i18n(`${i18nKey}.options.config.describe`),
    type: 'string',
  });
}

export function addOverwriteOptions(yargs: Argv): Argv {
  return yargs.option('overwrite', {
    alias: 'o',
    describe: i18n(`${i18nKey}.options.overwrite.describe`),
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
      `${i18nKey}.options.modes.describe.${
        read ? 'read' : write ? 'write' : 'default'
      }`,
      { modes: cmsPublishModes }
    ),
    type: 'string',
  });
}

export function addTestingOptions(yargs: Argv): Argv {
  return yargs.option('qa', {
    describe: i18n(`${i18nKey}.options.qa.describe`),
    type: 'boolean',
    default: false,
    hidden: true,
  });
}

export function addUseEnvironmentOptions(yargs: Argv): Argv {
  return yargs
    .option('use-env', {
      describe: i18n(`${i18nKey}.options.useEnv.describe`),
      type: 'boolean',
    })
    .conflicts('use-env', 'account');
}

export async function addCustomHelpOutput(
  yargs: Argv,
  command: string,
  describe: string
): Promise<void> {
  try {
    const parsedArgv = yargsParser(process.argv.slice(2));

    if (parsedArgv && parsedArgv.help) {
      const originalHelpOutput = await yargs.getHelp();
      const commandBase = `hs ${parsedArgv._.slice(0, -1).join(' ')}`;
      const fullCommand = `${commandBase.trim()} ${command}`;

      // Format the original help output to be more readable
      let prettyOriginalHelpOutput = originalHelpOutput;
      ['Options:', 'Examples:', 'Positionals:'].forEach(header => {
        prettyOriginalHelpOutput = prettyOriginalHelpOutput.replace(
          header,
          chalk.bold(header)
        );
      });

      const newHelpOutput = `${uiCommandReference(fullCommand, false)}\n\n${describe}\n\n${prettyOriginalHelpOutput}`;
      logger.log(newHelpOutput);
      process.exit(EXIT_CODES.SUCCESS);
    }
  } catch (e) {
    // Ignore error to allow yargs to show the default help output using the command description
    debugError(e);
  }
}

export function setLogLevel(options: Arguments<{ debug?: boolean }>): void {
  const { debug } = options;
  if (debug) {
    setLoggerLogLevel(LOG_LEVEL.DEBUG);
  } else {
    setLoggerLogLevel(LOG_LEVEL.LOG);
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

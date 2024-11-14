import {
  LOG_LEVEL,
  setLogLevel as setLoggerLogLevel,
} from '@hubspot/local-dev-lib/logger';
import { DEFAULT_MODE, MODE } from '@hubspot/local-dev-lib/constants/files';
import { Mode } from '@hubspot/local-dev-lib/types/Files';
import {
  getAccountId as getAccountIdFromConfig,
  getAccountConfig,
  getAndLoadConfigIfNeeded,
} from '@hubspot/local-dev-lib/config';
import { i18n } from './lang';
import { Argv, Arguments } from 'yargs';
const { loadAndValidateOptions } = require('./validation');
import fs from 'fs';

const i18nKey = 'lib.commonOpts';

export function addAccountOptions(yargs: Argv): Argv {
  return yargs.option('portal', {
    alias: ['p', 'account', 'a'],
    describe: i18n(`${i18nKey}.options.portal.describe`),
    type: 'string',
  });
}

export function addConfigOptions(yargs: Argv): Argv {
  return yargs.option('config', {
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

export function addModeOptions(
  yargs: Argv,
  { read, write }: { read?: boolean; write?: boolean }
): Argv {
  const modes = `<${Object.values(MODE).join(' | ')}>`;

  return yargs.option('mode', {
    alias: 'm',
    describe: i18n(
      `${i18nKey}.options.modes.describe.${
        read ? 'read' : write ? 'write' : 'default'
      }`,
      { modes }
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
  return yargs.option('use-env', {
    describe: i18n(`${i18nKey}.options.useEnv.describe`),
    type: 'boolean',
    default: false,
  });
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

/**
 * Obtains accountId using supplied --account flag or from environment variables
 */
export function getAccountId(
  options: Arguments<{ portal?: number | string; account?: number | string }>
): number | null {
  const { portal, account } = options || {};

  if (options?.useEnv && process.env.HUBSPOT_PORTAL_ID) {
    return parseInt(process.env.HUBSPOT_PORTAL_ID, 10);
  }

  return getAccountIdFromConfig(portal || account);
}

/**
 * Auto-injects the derivedAccountId flag into all commands
 */
export async function injectAccountIdMiddleware(
  options: Arguments<{
    derivedAccountId?: number | null;
    portal?: number | string;
    account?: number | string;
  }>
): Promise<void> {
  const { portal, account } = options;
  if (options.config) {
    if (fs.existsSync(options.config as string)) {
      await loadAndValidateOptions(options);
    }
  }

  // Preserves the original --account and --portal flags for certain commands.
  options.providedAccountId = portal || account;

  if (options.useEnv && process.env.HUBSPOT_PORTAL_ID) {
    options.derivedAccountId = parseInt(process.env.HUBSPOT_PORTAL_ID, 10);
    return;
  }

  options.derivedAccountId = getAccountIdFromConfig(portal || account);
}

export function getMode(options: Arguments<{ mode?: Mode }>): Mode {
  // 1. --mode
  const { mode } = options;
  if (mode && typeof mode === 'string') {
    return mode.toLowerCase() as Mode;
  }
  // 2. config[portal].defaultMode
  const accountId = getAccountId(options);
  if (accountId) {
    const accountConfig = getAccountConfig(accountId);
    if (accountConfig && accountConfig.defaultMode) {
      return accountConfig.defaultMode;
    }
  }
  // 3. config.defaultMode
  // 4. DEFAULT_MODE
  const config = getAndLoadConfigIfNeeded();
  return (config && (config.defaultMode as Mode)) || DEFAULT_MODE;
}

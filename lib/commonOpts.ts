import { Argv, Arguments } from 'yargs';
import {
  LOG_LEVEL,
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

const i18nKey = 'lib.commonOpts';

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

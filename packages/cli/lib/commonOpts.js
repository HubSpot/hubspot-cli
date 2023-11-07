const Logger = require('@hubspot/cli-lib/logger');
const { DEFAULT_MODE, Mode } = require('@hubspot/cli-lib');
const {
  getAccountId: getAccountIdFromConfig,
  getAccountConfig,
  getAndLoadConfigIfNeeded,
} = require('@hubspot/local-dev-lib/config');
const { i18n } = require('./lang');

const i18nKey = 'cli.lib.commonOpts';
const { LOG_LEVEL } = Logger;

const addAccountOptions = program =>
  program.option('portal', {
    alias: ['p', 'account', 'a'],
    describe: i18n(`${i18nKey}.options.portal.describe`),
    type: 'string',
  });

const addConfigOptions = yargs =>
  yargs.option('config', {
    alias: 'c',
    describe: i18n(`${i18nKey}.options.config.describe`),
    type: 'string',
  });

const addOverwriteOptions = yargs =>
  yargs.option('overwrite', {
    alias: 'o',
    describe: i18n(`${i18nKey}.options.overwrite.describe`),
    type: 'boolean',
    default: false,
  });

const addModeOptions = (yargs, { read, write }) => {
  const modes = `<${Object.values(Mode).join(' | ')}>`;

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
};

const addTestingOptions = yargs =>
  yargs.option('qa', {
    describe: i18n(`${i18nKey}.options.qa.describe`),
    type: 'boolean',
    default: false,
    hidden: true,
  });

const addUseEnvironmentOptions = yargs =>
  yargs.option('use-env', {
    describe: i18n(`${i18nKey}.options.useEnv.describe`),
    type: 'boolean',
    default: false,
  });

const setLogLevel = (options = {}) => {
  const { debug } = options;
  if (debug) {
    Logger.setLogLevel(LOG_LEVEL.DEBUG);
  } else {
    Logger.setLogLevel(LOG_LEVEL.LOG);
  }
};

/**
 * Get command name from Yargs `argv`
 * @param {object} argv
 */
const getCommandName = argv => (argv && argv._ && argv._[0]) || '';

/**
 * Obtains accountId using supplied --account flag or from environment variables
 */
const getAccountId = (options = {}) => {
  const { portal, account } = options;

  if (options.useEnv && process.env.HUBSPOT_PORTAL_ID) {
    return parseInt(process.env.HUBSPOT_PORTAL_ID, 10);
  }

  return getAccountIdFromConfig(portal || account);
};

const getMode = (command = {}) => {
  // 1. --mode
  const { mode } = command;
  if (mode && typeof mode === 'string') {
    return mode.toLowerCase();
  }
  // 2. config[portal].defaultMode
  const accountId = getAccountId(command);
  if (accountId) {
    const accountConfig = getAccountConfig(accountId);
    if (accountConfig && accountConfig.defaultMode) {
      return accountConfig.defaultMode;
    }
  }
  // 3. config.defaultMode
  // 4. DEFAULT_MODE
  const config = getAndLoadConfigIfNeeded();
  return (config && config.defaultMode) || DEFAULT_MODE;
};

module.exports = {
  addAccountOptions,
  addConfigOptions,
  addOverwriteOptions,
  addModeOptions,
  addTestingOptions,
  addUseEnvironmentOptions,
  getCommandName,
  getMode,
  getAccountId,
  setLogLevel,
};

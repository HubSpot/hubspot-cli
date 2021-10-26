const Logger = require('@hubspot/cli-lib/logger');
const {
  getAccountId: getAccountIdFromConfig,
  getAccount: getAccountFromConfig,
  getAccountConfig,
  getAndLoadConfigIfNeeded,
  DEFAULT_MODE,
  Mode,
} = require('@hubspot/cli-lib');
const { LOG_LEVEL } = Logger;

const addAccountOptions = program =>
  program.option('portal', {
    alias: ['p', 'account', 'a'],
    describe: 'HubSpot portal id or name from config',
    type: 'string',
  });

const addConfigOptions = yargs =>
  yargs.option('config', {
    alias: 'c',
    describe: 'path to a config file',
    type: 'string',
  });

const addOverwriteOptions = yargs =>
  yargs.option('overwrite', {
    alias: 'o',
    describe: 'overwrite existing files',
    type: 'boolean',
    default: false,
  });

const addModeOptions = (yargs, { read, write }) => {
  const modes = `<${Object.values(Mode).join(' | ')}>`;
  const help = read
    ? `read from ${modes}`
    : write
    ? `write to ${modes}`
    : `${modes}`;

  return yargs.option('mode', {
    alias: 'm',
    describe: help,
    type: 'string',
  });
};

const addTestingOptions = yargs =>
  yargs.option('qa', {
    describe: 'run command in qa mode',
    type: 'boolean',
    default: false,
    hidden: true,
  });

const addUseEnvironmentOptions = yargs =>
  yargs.option('use-env', {
    describe: 'use environment variable config',
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

/**
 * Obtains account name, portalId || accountId using supplied --account flag or from environment variables
 */
const getAccountDetails = (options = {}) => {
  const { portal, account } = options;

  if (options.useEnv && process.env.HUBSPOT_PORTAL_ID) {
    const portalId = parseInt(process.env.HUBSPOT_PORTAL_ID, 10);
    return { portalId, accountId: portalId };
  }
  const config = getAccountFromConfig(portal || account);

  return config
    ? {
        accountDescription: config.accountName
          ? `${config.accountName} (${config.accountId})`
          : config.accountId,
        ...config,
      }
    : null;
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
  getAccountDetails,
  getAccountId,
  setLogLevel,
};

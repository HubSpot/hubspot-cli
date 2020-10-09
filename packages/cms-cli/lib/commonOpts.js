const Logger = require('@hubspot/cms-lib/logger');
const {
  getAccountId: getAccountIdFromConfig,
  getAccountConfig,
  getAndLoadConfigIfNeeded,
  DEFAULT_MODE,
  Mode,
} = require('@hubspot/cms-lib');
const { LOG_LEVEL } = Logger;

const addAccountOptions = (program, useYargs = false) => {
  if (useYargs) {
    return program.option('account', {
      alias: ['a', 'portal', 'p'],
      describe: 'HubSpot account id or name from config',
      type: 'string',
    });
  }
  program.option('--portal <portal>', 'HubSpot portal id or name from config');
};

const addLoggerOptions = program => {
  program.option('--debug', 'set log level to debug', () => true, false);
};

const addConfigOptions = (program, useYargs = false) => {
  if (useYargs) {
    return program.option('config', {
      alias: 'c',
      describe: 'path to a config file',
      type: 'string',
    });
  }
  program.option('--config <config>', 'path to a config file');
};

const addOverwriteOptions = (program, useYargs = false) => {
  if (useYargs) {
    return program.option('overwrite', {
      alias: 'o',
      describe: 'overwrite existing files',
      type: 'boolean',
      default: false,
    });
  }

  program.option('--overwrite', 'overwrite existing files', false);
};

const addModeOptions = (program, { read, write }, useYargs = false) => {
  const modes = `<${Object.values(Mode).join(' | ')}>`;
  const help = read
    ? `read from ${modes}`
    : write
    ? `write to ${modes}`
    : `${modes}`;

  if (useYargs) {
    return program.option('mode', {
      alias: 'm',
      describe: help,
      type: 'string',
    });
  }

  program.option('--mode <mode>', help);
};

const addTestingOptions = (program, useYargs = false) => {
  if (useYargs) {
    return program.option('qa', {
      describe: 'run command in qa mode',
      type: 'boolean',
      default: false,
      hidden: true,
    });
  }
  program.option('--qa', 'run command in qa mode', false);
};

const addUseEnvironmentOptions = (program, useYargs = false) => {
  const option = 'use-env';
  const description = 'use environment variable config';

  if (useYargs) {
    return program.option(option, {
      describe: description,
      type: 'boolean',
      default: false,
    });
  }
  program.option(`--${option}`, description, false);
};

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

  if (options.useEnv && process.env.HUBSPOT_ACCOUNT_ID) {
    return parseInt(process.env.HUBSPOT_ACCOUNT_ID, 10);
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
  addLoggerOptions,
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

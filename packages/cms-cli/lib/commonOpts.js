const Logger = require('@hubspot/cms-lib/logger');
const {
  getPortalId: getPortalIdFromConfig,
  getPortalConfig,
  getAndLoadConfigIfNeeded,
  DEFAULT_MODE,
  Mode,
} = require('@hubspot/cms-lib');
const { LOG_LEVEL } = Logger;

const addPortalOptions = yargs =>
  yargs.option('portal', {
    alias: 'p',
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
 * Obtains portalId using supplied --portal flag or from environment variables
 */
const getPortalId = (options = {}) => {
  const { portal: portalNameOrId } = options;

  if (options.useEnv && process.env.HUBSPOT_PORTAL_ID) {
    return parseInt(process.env.HUBSPOT_PORTAL_ID, 10);
  }

  return getPortalIdFromConfig(portalNameOrId);
};

const getMode = (command = {}) => {
  // 1. --mode
  const { mode } = command;
  if (mode && typeof mode === 'string') {
    return mode.toLowerCase();
  }
  // 2. config[portal].defaultMode
  const portalId = getPortalId(command);
  if (portalId) {
    const portalConfig = getPortalConfig(portalId);
    if (portalConfig && portalConfig.defaultMode) {
      return portalConfig.defaultMode;
    }
  }
  // 3. config.defaultMode
  // 4. DEFAULT_MODE
  const config = getAndLoadConfigIfNeeded();
  return (config && config.defaultMode) || DEFAULT_MODE;
};

module.exports = {
  addPortalOptions,
  addConfigOptions,
  addOverwriteOptions,
  addModeOptions,
  addTestingOptions,
  addUseEnvironmentOptions,
  getCommandName,
  getMode,
  getPortalId,
  setLogLevel,
};

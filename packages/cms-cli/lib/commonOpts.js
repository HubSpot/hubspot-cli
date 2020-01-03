const Logger = require('@hubspot/cms-lib/logger');
const {
  getPortalId: getPortalIdFromConfig,
  getPortalConfig,
  getAndLoadConfigIfNeeded,
  DEFAULT_MODE,
  Mode,
} = require('@hubspot/cms-lib');
const { LOG_LEVEL } = Logger;

const addPortalOptions = (program, useYargs = false) => {
  if (useYargs) {
    return program.option('portal', {
      alias: 'p',
      describe: 'HubSpot portal id or name from config',
    });
  }
  program.option('--portal <portal>', 'HubSpot portal id or name from config');
};

const addLoggerOptions = (program, useYargs = false) => {
  if (useYargs) {
    return program.option('debug', {
      alias: 'd',
      default: false,
      describe: 'set log level to debug',
      type: 'boolean',
    });
  }
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
      alias: 'w',
      default: false,
      describe: 'overwrite existing files',
      type: 'boolean',
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
      choices: Object.values(Mode),
      describe: help,
    });
  }
  program.option('--mode <mode>', help);
};

const setLogLevel = (options = {}) => {
  const { debug } = options;
  if (debug) {
    Logger.setLogLevel(LOG_LEVEL.DEBUG);
  } else {
    Logger.setLogLevel(LOG_LEVEL.LOG);
  }
};

const getPortalId = (options = {}) => {
  const { portal } = options;
  return getPortalIdFromConfig(portal);
};

const getMode = (options = {}) => {
  // 1. --mode
  const { mode } = options;
  if (mode && typeof mode === 'string') {
    return mode.toLowerCase();
  }
  // 2. config[portal].defaultMode
  const portalId = getPortalId(options);
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

/**
 * Get command name from Yargs `argv`
 * @param {object} argv
 */
const getCommandName = argv => (argv && argv._ && argv._[0]) || '';

module.exports = {
  addPortalOptions,
  addLoggerOptions,
  addConfigOptions,
  addOverwriteOptions,
  addModeOptions,
  setLogLevel,
  getPortalId,
  getMode,
  getCommandName,
};

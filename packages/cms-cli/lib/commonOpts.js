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

const addOverwriteOptions = program => {
  program.option('--overwrite', 'overwrite existing files', false);
};

const addModeOptions = (program, { read, write }) => {
  const modes = `<${Object.values(Mode).join(' | ')}>`;
  const help = read
    ? `read from ${modes}`
    : write
    ? `write to ${modes}`
    : `${modes}`;
  program.option('--mode <mode>', help);
};

const addTestingOptions = (program, useYargs = false) => {
  if (useYargs) {
    return program.option('qa', {
      describe: 'run command in qa mode',
      type: 'boolean',
      default: false,
    });
  }
  program.option('--qa', 'run command in qa mode', false);
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
 * Obtains portalId using supplied --portal flag or from environment variables
 */
const getPortalId = (options = {}) => {
  const { portal: portalNameOrId } = options;

  if (process.env.HUBSPOT_PORTAL_ID) {
    return parseInt(process.env.HUBSPOT_PORTAL_ID, 10);
  }

  return getPortalIdFromConfig(portalNameOrId);
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

module.exports = {
  addPortalOptions,
  addLoggerOptions,
  addConfigOptions,
  addOverwriteOptions,
  addModeOptions,
  addTestingOptions,
  getCommandName,
  getMode,
  getPortalId,
  setLogLevel,
};

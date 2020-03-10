const Logger = require('@hubspot/cms-lib/logger');
const {
  getPortalId: getPortalIdFromConfig,
  getPortalConfig,
  getAndLoadConfigIfNeeded,
  loadConfigFromEnvironment,
  DEFAULT_MODE,
  Mode,
} = require('@hubspot/cms-lib');
const { LOG_LEVEL } = Logger;

const addPortalOptions = program => {
  program.option('--portal <portal>', 'HubSpot portal id or name from config');
};

const addLoggerOptions = program => {
  program.option('--debug', 'set log level to debug', () => true, false);
};

const addConfigOptions = program => {
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

const setLogLevel = (options = {}) => {
  const { debug } = options;
  if (debug) {
    Logger.setLogLevel(LOG_LEVEL.DEBUG);
  } else {
    Logger.setLogLevel(LOG_LEVEL.LOG);
  }
};

/**
 * Obtains portalId using supplied --portal flag or from environment variables
 */
const getPortalId = (options = {}) => {
  const envConfig = loadConfigFromEnvironment();
  const { portal: portalName } = options;
  return (
    (envConfig && envConfig.portals[0].portalId) ||
    getPortalIdFromConfig(portalName)
  );
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
  setLogLevel,
  getPortalId,
  getMode,
};

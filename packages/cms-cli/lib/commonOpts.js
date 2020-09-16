const Logger = require('@hubspot/cms-lib/logger');
const {
  getPortalId,
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
  addLoggerOptions,
  addConfigOptions,
  addOverwriteOptions,
  addModeOptions,
  addTestingOptions,
  getCommandName,
  getMode,
  setLogLevel,
};

const yaml = require('js-yaml');
const fs = require('fs');
const findup = require('findup-sync');
const { logger } = require('../../logger');
const {
  logErrorInstance,
  logFileSystemErrorInstance,
} = require('../../errorHandlers');
const { getCwd } = require('../../path');
const {
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  EMPTY_CONFIG_FILE_CONTENTS,
} = require('../constants');

let _config;
let _configPath;

const getOrderedPortalConfig = unorderedPortalConfig => {
  const {
    name,
    portalId,
    env,
    authType,
    auth,
    ...rest
  } = unorderedPortalConfig;

  return {
    name,
    portalId,
    env,
    authType,
    ...rest,
    auth,
  };
};

const getOrderedConfig = unorderedConfig => {
  const {
    defaultPortal,
    defaultMode,
    httpTimeout,
    allowsUsageTracking,
    portals,
    ...rest
  } = unorderedConfig;

  return {
    defaultPortal,
    defaultMode,
    httpTimeout,
    allowsUsageTracking,
    portals: portals.map(portal => getOrderedPortalConfig(portal)),
    ...rest,
  };
};

const writeConfig = () => {
  logger.debug(`Writing current config to ${_configPath}`);
  fs.writeFileSync(
    _configPath,
    yaml.safeDump(
      JSON.parse(JSON.stringify(getOrderedConfig(_config), null, 2))
    )
  );
};

const readConfigFile = () => {
  let source;
  let error;
  if (!_configPath) {
    return { source, error };
  }
  try {
    source = fs.readFileSync(_configPath);
  } catch (err) {
    error = err;
    logger.error('Config file could not be read "%s"', _configPath);
    logFileSystemErrorInstance(err, { filepath: _configPath, read: true });
  }
  return { source, error };
};

const parseConfig = configSource => {
  let parsed;
  let error;
  if (!configSource) {
    return { parsed, error };
  }
  try {
    parsed = yaml.safeLoad(configSource);
  } catch (err) {
    error = err;
    logger.error('Config file could not be parsed "%s"', _configPath);
    logErrorInstance(err);
  }
  return { parsed, error };
};

const loadConfig = (path, options = {}) => {
  _configPath = getConfigPath(path);
  if (!_configPath) {
    if (!options.silenceErrors) {
      logger.error(
        `A ${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} file could not be found`
      );
    }
    return;
  }

  logger.debug(`Reading config from ${_configPath}`);
  const { source, error: sourceError } = readConfigFile(_configPath);
  if (sourceError) return;
  const { parsed, error: parseError } = parseConfig(source);
  if (parseError) return;
  setConfig(Object.freeze(parsed));

  if (!_config) {
    logger.debug('The config file was empty config');
    logger.debug('Initializing an empty config');
    setConfig({
      portals: [],
    });
  }
};

const getAndLoadConfigIfNeeded = () => {
  if (!_config) {
    loadConfig(null, {
      silenceErrors: true,
    });
  }
  return _config;
};

const getConfig = () => _config;

const setConfig = updatedConfig => {
  _config = updatedConfig;
  return _config;
};

const getConfigPath = path => {
  return (
    path ||
    findup([
      DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
      DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME.replace('.yml', '.yaml'),
    ])
  );
};

const setConfigPath = path => {
  return (_configPath = path);
};

const setDefaultConfigPathIfUnset = () => {
  if (!_configPath) {
    setDefaultConfigPath();
  }
};

const setDefaultConfigPath = () => {
  setConfigPath(`${getCwd()}/${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME}`);
};

const configFileExists = () => {
  return _configPath && fs.existsSync(_configPath);
};

const configFileIsBlank = () => {
  return _configPath && fs.readFileSync(_configPath).length === 0;
};

const createEmptyConfigFile = () => {
  setDefaultConfigPathIfUnset();

  if (configFileExists()) {
    return;
  }

  return fs.writeFileSync(_configPath, EMPTY_CONFIG_FILE_CONTENTS);
};

const deleteEmptyConfigFile = () => {
  return (
    configFileExists() && configFileIsBlank() && fs.unlinkSync(_configPath)
  );
};

const isTrackingAllowed = () => {
  if (!configFileExists() || configFileIsBlank()) {
    return true;
  }
  const { allowUsageTracking } = getAndLoadConfigIfNeeded();
  return allowUsageTracking !== false;
};

module.exports = {
  createEmptyConfigFile,
  configFileExists,
  configFileIsBlank,
  deleteEmptyConfigFile,
  getAndLoadConfigIfNeeded,
  getConfig,
  getConfigPath,
  isTrackingAllowed,
  setConfig,
  setDefaultConfigPathIfUnset,
  loadConfig,
  writeConfig,
};

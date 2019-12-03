const yaml = require('js-yaml');
const fs = require('fs');
const findup = require('findup-sync');
const { logger } = require('../logger');
const {
  logErrorInstance,
  logFileSystemErrorInstance,
} = require('../errorHandlers');
const { getCwd } = require('../path');
const { DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME, Mode } = require('./constants');

let _config;
let _configPath;

const writeConfig = () => {
  logger.debug(`Writing current config to ${_configPath}`);
  fs.writeFileSync(
    _configPath,
    yaml.safeDump(JSON.parse(JSON.stringify(_config, null, 2)))
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

const loadConfig = path => {
  _configPath = getConfigPath(path);
  if (!_configPath) {
    logger.error(
      `A ${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} file could not be found`
    );
    return;
  }

  logger.debug(`Reading config from ${_configPath}`);
  const { source, error: sourceError } = readConfigFile(_configPath);
  if (sourceError) return;
  const { parsed, error: parseError } = parseConfig(source);
  if (parseError) return;
  _config = parsed;

  if (!_config) {
    logger.debug('The config file was empty config');
    logger.debug('Initializing an empty config');
    _config = {
      portals: [],
    };
  }
};

const getAndLoadConfigIfNeeded = () => {
  if (!_config) {
    loadConfig();
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

const getConfigEnv = environment => {
  return environment && environment.toUpperCase() === 'QA' ? 'QA' : undefined;
};

const getPortalConfig = portalId => {
  const config = getAndLoadConfigIfNeeded();
  return config.portals.find(portal => portal.portalId === portalId);
};

const getPortalId = nameOrId => {
  const config = getAndLoadConfigIfNeeded();
  let name;
  let portalId;
  let portal;
  if (!nameOrId) {
    if (config && config.defaultPortal) {
      name = config.defaultPortal;
    }
  } else {
    if (typeof nameOrId === 'number') {
      portalId = nameOrId;
    } else if (/^\d+$/.test(nameOrId)) {
      portalId = parseInt(nameOrId, 10);
    } else {
      name = nameOrId;
    }
  }

  if (name) {
    portal = config.portals.find(p => p.name === name);
  } else if (portalId) {
    portal = config.portals.find(p => p.portalId === portalId);
  }

  if (portal) {
    return portal.portalId;
  }

  return null;
};

/**
 * @throws {Error}
 */
const updatePortalConfig = configOptions => {
  const {
    portalId,
    authType,
    environment,
    clientId,
    clientSecret,
    scopes,
    tokenInfo,
    defaultMode,
  } = configOptions;

  if (!portalId) {
    throw new Error('A portalId is required to update the config');
  }

  const config = getAndLoadConfigIfNeeded();
  const portalConfig = getPortalConfig(portalId);

  let auth;
  if (clientId || clientSecret || scopes || tokenInfo) {
    auth = {
      ...(portalConfig ? portalConfig.auth : {}),
      clientId,
      clientSecret,
      scopes,
      tokenInfo,
    };
  }
  const env = getConfigEnv(environment);
  const mode = defaultMode && defaultMode.toLowerCase();
  const nextPortalConfig = {
    ...portalConfig,
    env,
    portalId,
    authType,
    auth,
    defaultMode: Mode[mode] ? mode : undefined,
  };

  if (portalConfig) {
    logger.debug(`Updating config for ${portalId}`);
    const index = config.portals.indexOf(portalConfig);
    config.portals[index] = nextPortalConfig;
  } else {
    logger.debug(`Adding config entry for ${portalId}`);
    if (config.portals) {
      config.portals.push(nextPortalConfig);
    } else {
      config.portals = [nextPortalConfig];
    }
  }
  writeConfig();
};

const setDefaultConfigPath = () => {
  setConfigPath(`${getCwd()}/${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME}`);
};

const writeNewPortalApiKeyConfig = configOptions => {
  setConfig(getNewPortalApiKeyConfig(configOptions));
  setDefaultConfigPath();
  writeConfig();
};

const getNewPortalApiKeyConfig = ({ name, portalId, apiKey, environment }) => {
  logger.log('Generating config data');
  return {
    defaultPortal: name,
    portals: [
      {
        name,
        portalId,
        apiKey,
        authType: 'apikey',
        env: getConfigEnv(environment),
      },
    ],
  };
};

const createEmptyConfigFile = () => {
  setDefaultConfigPath();
  fs.writeFileSync(_configPath, '');
};

module.exports = {
  getAndLoadConfigIfNeeded,
  getConfig,
  getConfigPath,
  setConfig,
  loadConfig,
  getPortalConfig,
  getPortalId,
  updatePortalConfig,
  writeNewPortalApiKeyConfig,
  createEmptyConfigFile,
};

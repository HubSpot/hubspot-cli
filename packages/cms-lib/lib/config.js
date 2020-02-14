const yaml = require('js-yaml');
const fs = require('fs');
const findup = require('findup-sync');
const { logger } = require('../logger');
const {
  logErrorInstance,
  logFileSystemErrorInstance,
} = require('../errorHandlers');
const { getCwd } = require('../path');
const {
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  EMPTY_CONFIG_FILE_CONTENTS,
  Mode,
  API_KEY_AUTH_METHOD,
  OAUTH_AUTH_METHOD,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} = require('./constants');

let _config;
let _configPath;

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
    portals,
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
  _config = Object.freeze(parsed);

  if (!_config) {
    logger.debug('The config file was empty config');
    logger.debug('Initializing an empty config');
    _config = {
      portals: [],
    };
  }
};

const isTrackingAllowed = () => {
  if (!configFileExists() || configFileIsBlank()) {
    return true;
  }
  const { allowUsageTracking } = getAndLoadConfigIfNeeded();
  return allowUsageTracking !== false;
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

const getPortalName = portalId => {
  return getPortalConfig(portalId).name;
};

/**
 * Returns mode(draft/publish) or undefined if invalid mode
 * @param {string} mode
 */
const getMode = mode => {
  return Mode[mode && mode.toLowerCase()];
};

/**
 * Updates non-authType-specific portalConfig properties
 * @param {object} portalConfig
 * @param {object} configUpdates
 */
const updateConfigProps = (portalConfig, configUpdates) => {
  return {
    ...portalConfig,
    name: configUpdates.name || portalConfig.name,
    env: configUpdates.env || portalConfig.env,
    defaultMode: getMode(configUpdates.defaultMode) || portalConfig.defaultMode,
  };
};

/**
 * Generates a portalConfig object from previous values and desired updates
 * @param {object} portalConfig Existing apiKey portalConfig
 * @param {object} configUpdates Object containing desired updates
 */
const getUpdatedApiKeyConfig = (portalConfig, configUpdates) => {
  const apiKey = configUpdates.apiKey || portalConfig.apiKey;

  if (!apiKey) {
    throw new Error('No apiKey passed to getUpdatedApiKeyConfig.');
  }

  return {
    ...updateConfigProps(portalConfig, configUpdates),
    authType: API_KEY_AUTH_METHOD.value,
    apiKey,
    auth: null,
    personalAccessKey: null,
  };
};

/**
 * Generates a portalConfig object from previous values and desired updates
 * @param {object} portalConfig Existing oauth2 portalConfig
 * @param {object} configUpdates Object containing desired updates
 */
const getUpdatedOauthConfig = (portalConfig, configUpdates) => {
  const auth = {
    ...portalConfig.auth,
    ...configUpdates.auth,
  };
  if (!auth) {
    throw new Error('No auth data passed to getUpdatedOauthConfig.');
  }

  if (!auth.tokenInfo) {
    throw new Error('No auth.tokenInfo data passed to getUpdatedOauthConfig.');
  }

  const config = {
    ...updateConfigProps(portalConfig, configUpdates),
    authType: OAUTH_AUTH_METHOD.value,
    auth,
  };

  delete config.apiKey;
  delete config.personalAccessKey;

  return config;
};

/**
 * Generates a portalConfig object from previous values and desired updates
 * @param {object} portalConfig Existing personalaccesskey portalConfig
 * @param {object} configUpdates Object containing desired updates
 */
const getUpdatedPersonalAccessKeyConfig = (portalConfig, configUpdates) => {
  const auth = {
    ...portalConfig.auth,
    ...configUpdates.auth,
  };
  if (!auth) {
    throw new Error(
      'No auth data passed to getUpdatedPersonalAccessKeyConfig.'
    );
  }

  if (!auth.tokenInfo) {
    throw new Error(
      'No auth.tokenInfo data passed to getUpdatedPersonalAccessKeyConfig.'
    );
  }

  const config = {
    ...updateConfigProps(portalConfig, configUpdates),
    authType: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
    auth,
  };

  delete config.apiKey;
  delete config.auth.clientId;
  delete config.auth.clientSecret;
  delete config.auth.tokenInfo.refreshToken;

  return config;
};

/**
 *
 * @param {object} configOptions An object containing properties to update in the portalConfig
 * @param {number} configOptions.portalId Portal ID to add/make updates to
 * @param {string} configOptions.authType Type of authentication used for this portalConfig
 * @param {string} configOptions.env Environment that this portal is located in(QA/PROD)
 * @param {string} configOptions.name Unique name used to reference this portalConfig
 * @param {object} configOptions.apiKey API key used in authType: apikey
 * @param {object} configOptions.defaultMode Default mode for uploads(draft or publish)
 * @param {object} configOptions.personalAccessKey Personal Access Key used in authType: personalaccesskey
 * @param {object} configOptions.auth Auth object used in oauth2 and personalaccesskey authTypes
 * @param {object} configOptions.auth.clientId Client ID used for oauth2
 * @param {object} configOptions.auth.clientSecret Client Secret used for oauth2
 * @param {object} configOptions.auth.scopes Scopes that are allowed access with auth
 * @param {object} configOptions.auth.tokenInfo Token Info used for oauth2 and personalaccesskey authTypes
 *
 */
const updatePortalConfig = configOptions => {
  const { portalId, authType } = configOptions;

  if (!portalId) {
    throw new Error('A portalId is required to update the config');
  }

  const config = getAndLoadConfigIfNeeded();
  const portalConfig = getPortalConfig(portalId);
  let updatedPortalConfig;

  switch (authType) {
    case PERSONAL_ACCESS_KEY_AUTH_METHOD.value: {
      updatedPortalConfig = getUpdatedPersonalAccessKeyConfig(
        portalConfig,
        configOptions
      );
      break;
    }
    case OAUTH_AUTH_METHOD.value: {
      updatedPortalConfig = getUpdatedOauthConfig(portalConfig, configOptions);
      break;
    }
    case API_KEY_AUTH_METHOD.value: {
      updatedPortalConfig = getUpdatedApiKeyConfig(portalConfig, configOptions);
      break;
    }
    default: {
      throw new Error(
        `Unrecognized authType: ${authType} passed to updatePortalConfig.`
      );
    }
  }

  if (portalConfig) {
    logger.debug(`Updating config for ${portalId}`);
    const index = config.portals.indexOf(portalConfig);
    config.portals[index] = updatedPortalConfig;
  } else {
    logger.debug(`Adding config entry for ${portalId}`);
    if (config.portals) {
      config.portals.push(updatedPortalConfig);
    } else {
      config.portals = [updatedPortalConfig];
    }
  }
  writeConfig();

  return updatedPortalConfig;
};

/**
 * @throws {Error}
 */
const updateDefaultPortal = defaultPortal => {
  if (
    !defaultPortal ||
    (typeof defaultPortal !== 'number' && typeof defaultPortal !== 'string')
  ) {
    throw new Error(
      'A defaultPortal with value of number or string is required to update the config'
    );
  }

  const config = getAndLoadConfigIfNeeded();
  config.defaultPortal = defaultPortal;
  setDefaultConfigPathIfUnset();
  writeConfig();
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

module.exports = {
  getAndLoadConfigIfNeeded,
  getConfig,
  getConfigPath,
  setConfig,
  loadConfig,
  getPortalConfig,
  getPortalId,
  getPortalName,
  updatePortalConfig,
  updateDefaultPortal,
  createEmptyConfigFile,
  deleteEmptyConfigFile,
  isTrackingAllowed,
};

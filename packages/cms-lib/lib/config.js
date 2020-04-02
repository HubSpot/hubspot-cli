const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const ignore = require('ignore');
const yaml = require('js-yaml');
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
  OAUTH_SCOPES,
  ENVIRONMENT_VARIABLES,
} = require('./constants');

let _config;
let _configPath;
let environmentVariableConfigLoaded = false;

const getConfig = () => _config;

const getConfigFilename = relativeTo => {
  const configPathSegments = _configPath.split('/');
  const configFilename = configPathSegments[configPathSegments.length - 1];

  return relativeTo
    ? path.relative(relativeTo, configFilename)
    : configFilename;
};

const setConfig = updatedConfig => {
  _config = updatedConfig;
  return _config;
};

/**
 * @returns {boolean}
 */
const validateConfig = () => {
  const config = getConfig();
  if (!config) {
    logger.error('config is not defined');
    return false;
  }
  if (!Array.isArray(config.portals)) {
    logger.error('config.portals[] is not defined');
    return false;
  }
  const portalsHash = {};
  return config.portals.every(cfg => {
    if (!cfg) {
      logger.error('config.portals[] has an empty entry');
      return false;
    }
    if (!cfg.portalId) {
      logger.error('config.portals[] has an entry missing portalId');
      return false;
    }
    if (portalsHash[cfg.portalId]) {
      logger.error(
        `config.portals[] has multiple entries with portalId=${cfg.portalId}`
      );
      return false;
    }
    portalsHash[cfg.portalId] = cfg;
    return true;
  });
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
    portals,
    ...rest,
  };
};

const makeComparisonDir = filepath => {
  if (typeof filepath !== 'string') return null;
  // Append sep to make comparisons easier e.g. 'foos'.startsWith('foo')
  return path.dirname(path.resolve(filepath)).toLowerCase() + path.sep;
};

const getConfigComparisonDir = () => makeComparisonDir(_configPath);

const getGitComparisonDir = () => makeComparisonDir(findup('.git'));

// Get all .gitignore files since they can cascade down directory structures
const getGitignoreFiles = () => {
  const gitDir = getGitComparisonDir();
  const files = [];
  if (!gitDir) {
    // Not in git
    return files;
  }
  // Start findup from config dir
  let cwd = _configPath && path.dirname(_configPath);
  while (cwd) {
    const ignorePath = findup('.gitignore', { cwd });
    if (
      ignorePath &&
      // Stop findup after .git dir is reached
      makeComparisonDir(ignorePath).startsWith(makeComparisonDir(gitDir))
    ) {
      const file = path.resolve(ignorePath);
      files.push(file);
      cwd = path.resolve(path.dirname(file) + '..');
    } else {
      cwd = null;
    }
  }
  return files;
};

const isConfigPathInGitRepo = () => {
  const gitDir = getGitComparisonDir();
  if (!gitDir) return false;
  const configDir = getConfigComparisonDir();
  if (!configDir) return false;
  return configDir.startsWith(gitDir);
};

const configFilenameIsIgnoredByGitignore = ignoreFiles => {
  return ignoreFiles.some(gitignore => {
    const gitignoreContents = fs.readFileSync(gitignore).toString();
    const gitignoreConfig = ignore().add(gitignoreContents);

    if (gitignoreConfig.ignores(getConfigFilename(gitignore))) {
      return true;
    }
    return false;
  });
};

const shouldWarnOfGitInclusion = () => {
  if (!isConfigPathInGitRepo()) {
    // Not in git
    return false;
  }
  if (configFilenameIsIgnoredByGitignore(getGitignoreFiles())) {
    // Found ignore statement in .gitignore that matches config filename
    return false;
  }
  // In git w/o a gitignore rule
  return true;
};

const checkAndWarnGitInclusion = () => {
  if (!shouldWarnOfGitInclusion()) return;
  logger.warn('Security Issue');
  logger.warn('Config file can be tracked by git.');
  logger.warn(`File: "${_configPath}"`);
  logger.warn(`To remediate:
  - Move config file to your home directory: "${os.homedir()}"
  - Add gitignore pattern "${getConfigFilename()}" to a .gitignore file in root of your repository.
  - Ensure that config file has not already been pushed to a remote repository.
`);
};

/**
 * @param {object}  options
 * @param {string}  options.path
 * @param {string}  options.source
 */
const writeConfig = (options = {}) => {
  if (environmentVariableConfigLoaded) {
    return;
  }
  let source;
  try {
    source =
      typeof options.source === 'string'
        ? options.source
        : yaml.safeDump(
            JSON.parse(JSON.stringify(getOrderedConfig(getConfig()), null, 2))
          );
  } catch (err) {
    logErrorInstance(err);
    return;
  }
  const configPath = options.path || _configPath;
  try {
    logger.debug(`Writing current config to ${configPath}`);
    fs.ensureFileSync(configPath);
    fs.writeFileSync(configPath, source);
  } catch (err) {
    logFileSystemErrorInstance(err, { filepath: configPath, write: true });
  }
};

const readConfigFile = () => {
  isConfigPathInGitRepo();
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

const loadConfigFromFile = (path, options = {}) => {
  setConfigPath(getConfigPath(path));
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
  _config = parsed;

  if (!_config) {
    logger.debug('The config file was empty config');
    logger.debug('Initializing an empty config');
    _config = {
      portals: [],
    };
  }
};

const loadConfig = (
  path,
  options = {
    ignoreEnvironmentVariableConfig: false,
  }
) => {
  if (
    !options.ignoreEnvironmentVariableConfig &&
    loadEnvironmentVariableConfig()
  ) {
    environmentVariableConfigLoaded = true;
    return;
  } else {
    loadConfigFromFile(path, options);
  }
};

const isTrackingAllowed = () => {
  if (!configFileExists() || configFileIsBlank()) {
    return true;
  }
  const { allowUsageTracking } = getAndLoadConfigIfNeeded();
  return allowUsageTracking !== false;
};

const getAndLoadConfigIfNeeded = (options = {}) => {
  if (!_config) {
    loadConfig(null, {
      silenceErrors: true,
      ...options,
    });
  }
  return _config || {};
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

const getEnv = nameOrId => {
  let env = 'PROD';
  const config = getAndLoadConfigIfNeeded();
  const portalId = getPortalId(nameOrId);
  if (portalId) {
    const portalConfig = getPortalConfig(portalId);
    if (portalConfig.env) {
      env = portalConfig.env;
    }
  } else if (config && config.env) {
    env = config.env;
  }
  return env;
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

  if (process.env.HUBSPOT_PORTAL_ID) {
    portalId = parseInt(process.env.HUBSPOT_PORTAL_ID, 10);
  } else if (!nameOrId) {
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
    name,
    apiKey,
    personalAccessKey,
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
  const env = getConfigEnv(environment || (portalConfig && portalConfig.env));
  const mode = defaultMode && defaultMode.toLowerCase();
  const nextPortalConfig = {
    ...portalConfig,
    name,
    env,
    portalId,
    authType,
    auth,
    apiKey,
    defaultMode: Mode[mode] ? mode : undefined,
    personalAccessKey,
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

  return nextPortalConfig;
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

  writeConfig({ source: EMPTY_CONFIG_FILE_CONTENTS });
};

const deleteEmptyConfigFile = () => {
  return (
    configFileExists() && configFileIsBlank() && fs.unlinkSync(_configPath)
  );
};

const getConfigVariablesFromEnv = () => {
  const env = process.env;

  return {
    apiKey: env[ENVIRONMENT_VARIABLES.HUBSPOT_API_KEY],
    clientId: env[ENVIRONMENT_VARIABLES.HUBSPOT_CLIENT_ID],
    clientSecret: env[ENVIRONMENT_VARIABLES.HUBSPOT_CLIENT_SECRET],
    personalAccessKey: env[ENVIRONMENT_VARIABLES.HUBSPOT_PERSONAL_ACCESS_KEY],
    portalId: parseInt(env[ENVIRONMENT_VARIABLES.HUBSPOT_PORTAL_ID], 10),
    refreshToken: env[ENVIRONMENT_VARIABLES.HUBSPOT_REFRESH_TOKEN],
  };
};

const generatePersonalAccessKeyConfig = (portalId, personalAccessKey) => {
  return {
    portals: [
      {
        authType: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
        portalId,
        personalAccessKey,
      },
    ],
  };
};

const generateOauthConfig = (
  portalId,
  clientId,
  clientSecret,
  refreshToken,
  scopes
) => {
  return {
    portals: [
      {
        authType: OAUTH_AUTH_METHOD.value,
        portalId,
        auth: {
          clientId,
          clientSecret,
          scopes,
          tokenInfo: {
            refreshToken,
          },
        },
      },
    ],
  };
};

const generateApiKeyConfig = (portalId, apiKey) => {
  return {
    portals: [
      {
        authType: API_KEY_AUTH_METHOD.value,
        portalId,
        apiKey,
      },
    ],
  };
};

const loadConfigFromEnvironment = () => {
  const {
    apiKey,
    clientId,
    clientSecret,
    personalAccessKey,
    portalId,
    refreshToken,
  } = getConfigVariablesFromEnv();

  if (!portalId) {
    return;
  }

  if (personalAccessKey) {
    return generatePersonalAccessKeyConfig(portalId, personalAccessKey);
  } else if (clientId && clientSecret && refreshToken) {
    return generateOauthConfig(
      portalId,
      clientId,
      clientSecret,
      refreshToken,
      OAUTH_SCOPES.map(scope => scope.value)
    );
  } else if (apiKey) {
    return generateApiKeyConfig(portalId, apiKey);
  } else {
    return;
  }
};

const loadEnvironmentVariableConfig = () => {
  const envConfig = loadConfigFromEnvironment();

  if (!envConfig) {
    return;
  }

  return setConfig(envConfig);
};

module.exports = {
  checkAndWarnGitInclusion,
  getAndLoadConfigIfNeeded,
  getEnv,
  getConfig,
  getConfigPath,
  setConfig,
  setConfigPath,
  loadConfig,
  loadConfigFromEnvironment,
  getPortalConfig,
  getPortalId,
  updatePortalConfig,
  updateDefaultPortal,
  createEmptyConfigFile,
  deleteEmptyConfigFile,
  isTrackingAllowed,
  validateConfig,
  writeConfig,
  configFilenameIsIgnoredByGitignore,
};

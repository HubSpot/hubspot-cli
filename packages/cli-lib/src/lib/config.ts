import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { AccountConfig, Environment, Account, Scope, AuthType } from '../types';
const ignore = require('ignore');
const yaml = require('js-yaml');
const findup = require('findup-sync');
const { logger } = require('../logger');
const {
  logFileSystemErrorInstance,
} = require('../errorHandlers/fileSystemErrors');
const { logErrorInstance } = require('../errorHandlers/standardErrors');
const { getCwd } = require('../path');
import {
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  EMPTY_CONFIG_FILE_CONTENTS,
  Mode,
  ENVIRONMENTS,
  API_KEY_AUTH_METHOD,
  OAUTH_AUTH_METHOD,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
  OAUTH_SCOPES,
  ENVIRONMENT_VARIABLES,
} from './constants';
const { getValidEnv } = require('./environment');

type ConfigAPIOptions = {
  source?: string;
  path?: string;
  silenceErrors?: boolean;
  useEnv?: boolean;
};

let _config: AccountConfig | undefined;
let _configPath: string;
let environmentVariableConfigLoaded = false;

export const getConfig = (): AccountConfig | undefined => _config;

export const setConfig = (
  updatedConfig: AccountConfig | undefined
): AccountConfig | undefined => {
  _config = updatedConfig;
  return _config;
};

export const getConfigAccounts = (config?: AccountConfig) => {
  const __config = config || getConfig();
  // TS-TODO: Should we return an empty array here? I didn't do it yet because !![] === true
  // which would be a behavior change
  if (!__config) return;
  return __config.portals;
};

export const getConfigDefaultAccount = (config?: AccountConfig) => {
  const __config = config || getConfig();
  if (!__config) return;
  return __config.defaultPortal;
};

export const getConfigAccountId = (account: Account) => {
  // TS-TODO: It looks like account is a portal config, whereas getConfig
  // returns the whole config file... is this a bug?  Also, account should
  // be an optional param, but doing so will make TS complain about what I just mentioned
  // so fix this either way
  const __config = account || getConfig();
  if (!__config) return;
  // @ts-ignore
  return __config.portalId;
};

export const validateConfig = () => {
  const config = getConfig();
  if (!config) {
    logger.error('No config was found');
    return false;
  }
  const accounts = getConfigAccounts();
  if (!Array.isArray(accounts)) {
    logger.error('config.portals[] is not defined');
    return false;
  }
  const accountIdsHash: { [key: string]: Account } = {};
  const accountNamesHash: { [key: string]: Account } = {};
  return accounts.every(cfg => {
    if (!cfg) {
      logger.error('config.portals[] has an empty entry');
      return false;
    }

    const accountId = getConfigAccountId(cfg);
    if (!accountId) {
      logger.error('config.portals[] has an entry missing portalId');
      return false;
    }
    if (accountIdsHash[accountId]) {
      logger.error(
        `config.portals[] has multiple entries with portalId=${accountId}`
      );
      return false;
    }

    if (cfg.name) {
      if (accountNamesHash[cfg.name]) {
        logger.error(
          `config.name has multiple entries with portalId=${accountId}`
        );
        return false;
      }
      if (/\s+/.test(cfg.name)) {
        logger.error(`config.name '${cfg.name}' cannot contain spaces`);
        return false;
      }
      accountNamesHash[cfg.name] = cfg;
    }

    accountIdsHash[accountId] = cfg;
    return true;
  });
};

export const accountNameExistsInConfig = (name: string) => {
  const config = getConfig();
  const accounts = getConfigAccounts();

  if (!config || !Array.isArray(accounts)) {
    return false;
  }

  return accounts.some(cfg => cfg.name && cfg.name === name);
};

export const getOrderedAccount = (unorderedAccount: Account) => {
  const { name, portalId, env, authType, ...rest } = unorderedAccount;

  return {
    name,
    ...(portalId && { portalId }),
    env,
    authType,
    ...rest,
  };
};

export const getOrderedConfig = (unorderedConfig?: AccountConfig) => {
  if (!unorderedConfig) return;

  const {
    defaultPortal,
    defaultMode,
    httpTimeout,
    allowUsageTracking,
    portals,
    ...rest
  } = unorderedConfig;

  return {
    ...(defaultPortal && { defaultPortal }),
    defaultMode,
    httpTimeout,
    allowUsageTracking,
    ...rest,
    portals: portals?.map(getOrderedAccount),
  };
};

export const makeComparisonDir = (filepath: string) => {
  if (typeof filepath !== 'string') return null;
  // Append sep to make comparisons easier e.g. 'foos'.startsWith('foo')
  return path.dirname(path.resolve(filepath)).toLowerCase() + path.sep;
};

export const getConfigComparisonDir = () => makeComparisonDir(_configPath);

export const getGitComparisonDir = () => makeComparisonDir(findup('.git'));

// Get all .gitignore files since they can cascade down directory structures
export const getGitignoreFiles = () => {
  const gitDir = getGitComparisonDir();
  const files: Array<string> = [];
  if (!gitDir) {
    // Not in git
    return files;
  }
  // Start findup from config dir
  let cwd: boolean | string | null = _configPath && path.dirname(_configPath);
  while (cwd) {
    const ignorePath = findup('.gitignore', { cwd });
    if (
      ignorePath &&
      // Stop findup after .git dir is reached
      makeComparisonDir(ignorePath)?.startsWith(makeComparisonDir(gitDir) || '')
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

export const isConfigPathInGitRepo = () => {
  const gitDir = getGitComparisonDir();
  if (!gitDir) return false;
  const configDir = getConfigComparisonDir();
  if (!configDir) return false;
  return configDir.startsWith(gitDir);
};

export const configFilenameIsIgnoredByGitignore = (
  ignoreFiles: Array<string>
) => {
  return ignoreFiles.some(gitignore => {
    const gitignoreContents = fs.readFileSync(gitignore).toString();
    const gitignoreConfig = ignore().add(gitignoreContents);

    if (
      gitignoreConfig.ignores(
        path.relative(path.dirname(gitignore), _configPath)
      )
    ) {
      return true;
    }
    return false;
  });
};

export const shouldWarnOfGitInclusion = () => {
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

export const checkAndWarnGitInclusion = () => {
  try {
    if (!shouldWarnOfGitInclusion()) return;
    logger.warn('Security Issue');
    logger.warn('Config file can be tracked by git.');
    logger.warn(`File: "${_configPath}"`);
    logger.warn(`To remediate:
      - Move config file to your home directory: "${os.homedir()}"
      - Add gitignore pattern "${path.basename(
        _configPath
      )}" to a .gitignore file in root of your repository.
      - Ensure that config file has not already been pushed to a remote repository.
    `);
  } catch (e) {
    // fail silently
    logger.debug(
      'Unable to determine if config file is properly ignored by git.'
    );
  }
};

export const writeConfig = (options: ConfigAPIOptions = {}) => {
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

export const readConfigFile = () => {
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

export const parseConfig = (configSource: Buffer | undefined) => {
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

export const loadConfigFromFile = (
  path: string | null,
  options: ConfigAPIOptions = {}
) => {
  setConfigPath(getConfigPath(path));
  if (!_configPath) {
    if (!options.silenceErrors) {
      logger.error(
        `A ${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} file could not be found`
      );
    } else {
      logger.debug(
        `A ${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} file could not be found`
      );
    }
    return;
  }

  logger.debug(`Reading config from ${_configPath}`);
  const { source, error: sourceError } = readConfigFile();
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

export const loadConfig = (
  path: string | null,
  options: ConfigAPIOptions = {
    useEnv: false,
  }
) => {
  if (options.useEnv && loadEnvironmentVariableConfig()) {
    logger.debug('Loaded environment variable config');
    environmentVariableConfigLoaded = true;
    return;
  } else {
    logger.debug(`Loaded config from ${path}`);
    loadConfigFromFile(path, options);
    environmentVariableConfigLoaded = false;
  }
};

export const isTrackingAllowed = () => {
  if (!configFileExists() || configFileIsBlank()) {
    return true;
  }
  const { allowUsageTracking } = getAndLoadConfigIfNeeded();
  return allowUsageTracking !== false;
};

export const getAndLoadConfigIfNeeded = (options = {}): AccountConfig => {
  if (!_config) {
    loadConfig(null, {
      silenceErrors: true,
      ...options,
    });
  }
  return _config || {};
};

const getConfigPath = (path: string | null) => {
  return path || (configFileExists() && _configPath) || findConfig(getCwd());
};

export const findConfig = (directory: string) => {
  return findup(
    [
      DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
      DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME.replace('.yml', '.yaml'),
    ],
    { cwd: directory }
  );
};

export const setConfigPath = (path: string) => {
  return (_configPath = path);
};

export const getEnv = (nameOrId?: string) => {
  let env = ENVIRONMENTS.PROD;
  const config = getAndLoadConfigIfNeeded();
  const accountId = getAccountId(nameOrId);

  if (accountId) {
    const accountConfig = getAccountConfig(accountId);
    if (accountConfig?.env) {
      env = accountConfig.env;
    }
  } else if (config && config.env) {
    env = config.env;
  }
  return env;
};

export const getAccountConfig = (accountId?: number | string) =>
  getConfigAccounts(getAndLoadConfigIfNeeded())?.find(
    account => account.portalId === accountId
  );

export const getAccountId = (nameOrId?: string | number) => {
  const config = getAndLoadConfigIfNeeded();
  let name: string | number | undefined;
  let accountId: number | undefined;
  let account: Account | undefined;

  if (!nameOrId) {
    const defaultAccount = getConfigDefaultAccount(config);

    if (defaultAccount) {
      name = defaultAccount;
    }
  } else {
    if (typeof nameOrId === 'number') {
      accountId = nameOrId;
    } else if (/^\d+$/.test(nameOrId)) {
      accountId = parseInt(nameOrId, 10);
    } else {
      name = nameOrId;
    }
  }

  const accounts = getConfigAccounts(config);
  if (name) {
    account = accounts?.find(p => p.name === name);
  } else if (accountId) {
    account = accounts?.find(p => accountId === p.portalId);
  }

  if (account) {
    return account.portalId;
  }

  return null;
};

export const updateAccountConfig = (configOptions: Account) => {
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
    throw new Error('An portalId is required to update the config');
  }

  const config = getAndLoadConfigIfNeeded();
  const accountConfig = getAccountConfig(portalId);

  let auth;
  if (clientId || clientSecret || scopes || tokenInfo) {
    auth = {
      ...(accountConfig ? accountConfig.auth : {}),
      clientId,
      clientSecret,
      scopes,
      tokenInfo,
    };
  }

  const env = getValidEnv(environment || (accountConfig && accountConfig.env), {
    maskedProductionValue: undefined,
  });
  const mode = defaultMode && (defaultMode.toLowerCase() as Mode);
  const nextAccountConfig = {
    ...accountConfig,
    name: name || (accountConfig && accountConfig.name),
    env,
    ...(portalId && { portalId }),
    authType,
    auth,
    apiKey,
    defaultMode: (Mode as any)[mode || ''] ? mode : undefined,
    personalAccessKey,
  };

  let accounts = getConfigAccounts(config) || [];
  if (accountConfig) {
    logger.debug(`Updating config for ${portalId}`);
    const index = accounts?.indexOf(accountConfig);
    if (typeof index === 'number' && index !== -1) {
      accounts[index] = nextAccountConfig;
    }
  } else {
    logger.debug(`Adding config entry for ${portalId}`);
    if (accounts) {
      accounts.push(nextAccountConfig);
    } else {
      accounts = [nextAccountConfig];
    }
  }

  return nextAccountConfig;
};

export const updateDefaultAccount = (defaultAccount?: number | string) => {
  if (
    !defaultAccount ||
    (typeof defaultAccount !== 'number' && typeof defaultAccount !== 'string')
  ) {
    throw new Error(
      `A 'defaultPortal' with value of number or string is required to update the config`
    );
  }

  const config = getAndLoadConfigIfNeeded();
  config.defaultPortal = defaultAccount;

  setDefaultConfigPathIfUnset();
  writeConfig();
};

export const setDefaultConfigPathIfUnset = () => {
  if (!_configPath) {
    setDefaultConfigPath();
  }
};

export const setDefaultConfigPath = () => {
  setConfigPath(`${getCwd()}/${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME}`);
};

export const configFileExists = () => {
  return _configPath && fs.existsSync(_configPath);
};

export const configFileIsBlank = () => {
  return _configPath && fs.readFileSync(_configPath).length === 0;
};

export const createEmptyConfigFile = ({ path }: { path?: string } = {}) => {
  if (!path) {
    setDefaultConfigPathIfUnset();

    if (configFileExists()) {
      return;
    }
  } else {
    setConfigPath(path);
  }

  writeConfig({ source: EMPTY_CONFIG_FILE_CONTENTS, path });
};

export const deleteEmptyConfigFile = () => {
  return (
    configFileExists() && configFileIsBlank() && fs.unlinkSync(_configPath)
  );
};

export const getConfigVariablesFromEnv = () => {
  const env = process.env;

  return {
    apiKey: env[ENVIRONMENT_VARIABLES.HUBSPOT_API_KEY],
    clientId: env[ENVIRONMENT_VARIABLES.HUBSPOT_CLIENT_ID],
    clientSecret: env[ENVIRONMENT_VARIABLES.HUBSPOT_CLIENT_SECRET],
    personalAccessKey: env[ENVIRONMENT_VARIABLES.HUBSPOT_PERSONAL_ACCESS_KEY],
    portalId: parseInt(env[ENVIRONMENT_VARIABLES.HUBSPOT_PORTAL_ID] || '', 10),
    refreshToken: env[ENVIRONMENT_VARIABLES.HUBSPOT_REFRESH_TOKEN],
    env: getValidEnv(env[ENVIRONMENT_VARIABLES.HUBSPOT_ENVIRONMENT]),
  };
};

export const generatePersonalAccessKeyConfig = (
  portalId: number,
  personalAccessKey: string,
  env: Environment
): AccountConfig => {
  return {
    portals: [
      {
        authType: PERSONAL_ACCESS_KEY_AUTH_METHOD.value as AuthType,
        portalId,
        personalAccessKey,
        env,
      },
    ],
  };
};

export const generateOauthConfig = (
  portalId: string | number,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  scopes: Array<Scope>,
  env: Environment
): AccountConfig => {
  return {
    portals: [
      {
        authType: OAUTH_AUTH_METHOD.value as AuthType,
        portalId,
        auth: {
          clientId,
          clientSecret,
          scopes,
          tokenInfo: {
            refreshToken,
          },
        },
        env,
      },
    ],
  };
};

export const generateApiKeyConfig = (
  portalId: string | number,
  apiKey: string,
  env: Environment
): AccountConfig => {
  return {
    portals: [
      {
        authType: API_KEY_AUTH_METHOD.value as AuthType,
        portalId,
        apiKey,
        env,
      },
    ],
  };
};

export const loadConfigFromEnvironment = (): AccountConfig | undefined => {
  const {
    apiKey,
    clientId,
    clientSecret,
    personalAccessKey,
    portalId,
    refreshToken,
    env,
  } = getConfigVariablesFromEnv();

  if (!portalId) {
    return;
  }

  if (personalAccessKey) {
    return generatePersonalAccessKeyConfig(portalId, personalAccessKey, env);
  } else if (clientId && clientSecret && refreshToken) {
    return generateOauthConfig(
      portalId,
      clientId,
      clientSecret,
      refreshToken,
      OAUTH_SCOPES.map(scope => scope.value),
      env
    );
  } else if (apiKey) {
    return generateApiKeyConfig(portalId, apiKey, env);
  } else {
    return;
  }
};

export const loadEnvironmentVariableConfig = () => {
  const envConfig = loadConfigFromEnvironment();

  if (!envConfig) {
    return;
  }
  const { portalId } = getConfigVariablesFromEnv();

  logger.debug(
    `Loaded config from environment variables for account ${portalId}`
  );

  return setConfig(envConfig);
};

export const isConfigFlagEnabled = (flag: string) => {
  if (!configFileExists() || configFileIsBlank()) {
    return false;
  }

  const config = getAndLoadConfigIfNeeded();

  return flag in config || false;
};

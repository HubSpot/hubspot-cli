"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEnvironmentVariableConfig = exports.loadConfigFromEnvironment = exports.generateApiKeyConfig = exports.generateOauthConfig = exports.generatePersonalAccessKeyConfig = exports.getConfigVariablesFromEnv = exports.deleteEmptyConfigFile = exports.createEmptyConfigFile = exports.configFileIsBlank = exports.configFileExists = exports.setDefaultConfigPath = exports.setDefaultConfigPathIfUnset = exports.updateDefaultAccount = exports.updateAccountConfig = exports.getAccountId = exports.getAccountConfig = exports.getEnv = exports.setConfigPath = exports.findConfig = exports.getConfigPath = exports.getAndLoadConfigIfNeeded = exports.isTrackingAllowed = exports.loadConfig = exports.loadConfigFromFile = exports.parseConfig = exports.readConfigFile = exports.writeConfig = exports.checkAndWarnGitInclusion = exports.shouldWarnOfGitInclusion = exports.configFilenameIsIgnoredByGitignore = exports.isConfigPathInGitRepo = exports.getGitignoreFiles = exports.getGitComparisonDir = exports.getConfigComparisonDir = exports.makeComparisonDir = exports.getOrderedConfig = exports.getOrderedAccount = exports.accountNameExistsInConfig = exports.validateConfig = exports.getConfigAccountId = exports.getConfigDefaultAccount = exports.getConfigAccounts = exports.setConfig = exports.getConfig = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const ignore = require('ignore');
const yaml = require('js-yaml');
const findup = require('findup-sync');
const { logger } = require('../logger');
const { logFileSystemErrorInstance, } = require('../errorHandlers/fileSystemErrors');
const { logErrorInstance } = require('../errorHandlers/standardErrors');
const { getCwd } = require('../path');
const constants_1 = require("./constants");
const { getValidEnv } = require('./environment');
let _config;
let _configPath;
let environmentVariableConfigLoaded = false;
const getConfig = () => _config;
exports.getConfig = getConfig;
const setConfig = (updatedConfig) => {
    _config = updatedConfig;
    return _config;
};
exports.setConfig = setConfig;
const getConfigAccounts = (config) => {
    const __config = config || exports.getConfig();
    // TS-TODO: Should we return an empty array here? I didn't do it yet because !![] === true
    // which would be a behavior change
    if (!__config)
        return;
    return __config.portals;
};
exports.getConfigAccounts = getConfigAccounts;
const getConfigDefaultAccount = (config) => {
    const __config = config || exports.getConfig();
    if (!__config)
        return;
    return __config.defaultPortal;
};
exports.getConfigDefaultAccount = getConfigDefaultAccount;
const getConfigAccountId = (account) => {
    // TS-TODO: It looks like account is a portal config, whereas getConfig
    // returns the whole config file... is this a bug?  Also, account should
    // be an optional param, but doing so will make TS complain about what I just mentioned
    // so fix this either way
    const __config = account || exports.getConfig();
    if (!__config)
        return;
    return __config.portalId;
};
exports.getConfigAccountId = getConfigAccountId;
const validateConfig = () => {
    const config = exports.getConfig();
    if (!config) {
        logger.error('config is not defined');
        return false;
    }
    const accounts = exports.getConfigAccounts();
    if (!Array.isArray(accounts)) {
        logger.error('config.portals[] is not defined');
        return false;
    }
    const accountIdsHash = {};
    const accountNamesHash = {};
    return accounts.every(cfg => {
        if (!cfg) {
            logger.error('config.portals[] has an empty entry');
            return false;
        }
        const accountId = exports.getConfigAccountId(cfg);
        if (!accountId) {
            logger.error('config.portals[] has an entry missing portalId');
            return false;
        }
        if (accountIdsHash[accountId]) {
            logger.error(`config.portals[] has multiple entries with portalId=${accountId}`);
            return false;
        }
        if (cfg.name) {
            if (accountNamesHash[cfg.name]) {
                logger.error(`config.name has multiple entries with portalId=${accountId}`);
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
exports.validateConfig = validateConfig;
const accountNameExistsInConfig = (name) => {
    const config = exports.getConfig();
    const accounts = exports.getConfigAccounts();
    if (!config || !Array.isArray(accounts)) {
        return false;
    }
    return accounts.some(cfg => cfg.name && cfg.name === name);
};
exports.accountNameExistsInConfig = accountNameExistsInConfig;
const getOrderedAccount = (unorderedAccount) => {
    const { name, portalId, env, authType } = unorderedAccount, rest = __rest(unorderedAccount, ["name", "portalId", "env", "authType"]);
    return Object.assign(Object.assign(Object.assign({ name }, (portalId && { portalId })), { env,
        authType }), rest);
};
exports.getOrderedAccount = getOrderedAccount;
const getOrderedConfig = (unorderedConfig) => {
    if (!unorderedConfig)
        return;
    const { defaultPortal, defaultMode, httpTimeout, allowsUsageTracking, portals } = unorderedConfig, rest = __rest(unorderedConfig, ["defaultPortal", "defaultMode", "httpTimeout", "allowsUsageTracking", "portals"]);
    return Object.assign(Object.assign(Object.assign({}, (defaultPortal && { defaultPortal })), { defaultMode,
        httpTimeout,
        allowsUsageTracking, portals: portals === null || portals === void 0 ? void 0 : portals.map(exports.getOrderedAccount) }), rest);
};
exports.getOrderedConfig = getOrderedConfig;
const makeComparisonDir = (filepath) => {
    if (typeof filepath !== 'string')
        return null;
    // Append sep to make comparisons easier e.g. 'foos'.startsWith('foo')
    return path_1.default.dirname(path_1.default.resolve(filepath)).toLowerCase() + path_1.default.sep;
};
exports.makeComparisonDir = makeComparisonDir;
const getConfigComparisonDir = () => exports.makeComparisonDir(_configPath);
exports.getConfigComparisonDir = getConfigComparisonDir;
const getGitComparisonDir = () => exports.makeComparisonDir(findup('.git'));
exports.getGitComparisonDir = getGitComparisonDir;
// Get all .gitignore files since they can cascade down directory structures
const getGitignoreFiles = () => {
    var _a;
    const gitDir = exports.getGitComparisonDir();
    const files = [];
    if (!gitDir) {
        // Not in git
        return files;
    }
    // Start findup from config dir
    let cwd = _configPath && path_1.default.dirname(_configPath);
    while (cwd) {
        const ignorePath = findup('.gitignore', { cwd });
        if (ignorePath &&
            (
            // Stop findup after .git dir is reached
            (_a = exports.makeComparisonDir(ignorePath)) === null || _a === void 0 ? void 0 : _a.startsWith(exports.makeComparisonDir(gitDir) || ''))) {
            const file = path_1.default.resolve(ignorePath);
            files.push(file);
            cwd = path_1.default.resolve(path_1.default.dirname(file) + '..');
        }
        else {
            cwd = null;
        }
    }
    return files;
};
exports.getGitignoreFiles = getGitignoreFiles;
const isConfigPathInGitRepo = () => {
    const gitDir = exports.getGitComparisonDir();
    if (!gitDir)
        return false;
    const configDir = exports.getConfigComparisonDir();
    if (!configDir)
        return false;
    return configDir.startsWith(gitDir);
};
exports.isConfigPathInGitRepo = isConfigPathInGitRepo;
const configFilenameIsIgnoredByGitignore = (ignoreFiles) => {
    return ignoreFiles.some(gitignore => {
        const gitignoreContents = fs_extra_1.default.readFileSync(gitignore).toString();
        const gitignoreConfig = ignore().add(gitignoreContents);
        if (gitignoreConfig.ignores(path_1.default.relative(path_1.default.dirname(gitignore), _configPath))) {
            return true;
        }
        return false;
    });
};
exports.configFilenameIsIgnoredByGitignore = configFilenameIsIgnoredByGitignore;
const shouldWarnOfGitInclusion = () => {
    if (!exports.isConfigPathInGitRepo()) {
        // Not in git
        return false;
    }
    if (exports.configFilenameIsIgnoredByGitignore(exports.getGitignoreFiles())) {
        // Found ignore statement in .gitignore that matches config filename
        return false;
    }
    // In git w/o a gitignore rule
    return true;
};
exports.shouldWarnOfGitInclusion = shouldWarnOfGitInclusion;
const checkAndWarnGitInclusion = () => {
    try {
        if (!exports.shouldWarnOfGitInclusion())
            return;
        logger.warn('Security Issue');
        logger.warn('Config file can be tracked by git.');
        logger.warn(`File: "${_configPath}"`);
        logger.warn(`To remediate:
      - Move config file to your home directory: "${os_1.default.homedir()}"
      - Add gitignore pattern "${path_1.default.basename(_configPath)}" to a .gitignore file in root of your repository.
      - Ensure that config file has not already been pushed to a remote repository.
    `);
    }
    catch (e) {
        // fail silently
        logger.debug('Unable to determine if config file is properly ignored by git.');
    }
};
exports.checkAndWarnGitInclusion = checkAndWarnGitInclusion;
const writeConfig = (options = {}) => {
    if (environmentVariableConfigLoaded) {
        return;
    }
    let source;
    try {
        source =
            typeof options.source === 'string'
                ? options.source
                : yaml.safeDump(JSON.parse(JSON.stringify(exports.getOrderedConfig(exports.getConfig()), null, 2)));
    }
    catch (err) {
        logErrorInstance(err);
        return;
    }
    const configPath = options.path || _configPath;
    try {
        logger.debug(`Writing current config to ${configPath}`);
        fs_extra_1.default.ensureFileSync(configPath);
        fs_extra_1.default.writeFileSync(configPath, source);
    }
    catch (err) {
        logFileSystemErrorInstance(err, { filepath: configPath, write: true });
    }
};
exports.writeConfig = writeConfig;
const readConfigFile = () => {
    exports.isConfigPathInGitRepo();
    let source;
    let error;
    if (!_configPath) {
        return { source, error };
    }
    try {
        source = fs_extra_1.default.readFileSync(_configPath);
    }
    catch (err) {
        error = err;
        logger.error('Config file could not be read "%s"', _configPath);
        logFileSystemErrorInstance(err, { filepath: _configPath, read: true });
    }
    return { source, error };
};
exports.readConfigFile = readConfigFile;
const parseConfig = (configSource) => {
    let parsed;
    let error;
    if (!configSource) {
        return { parsed, error };
    }
    try {
        parsed = yaml.safeLoad(configSource);
    }
    catch (err) {
        error = err;
        logger.error('Config file could not be parsed "%s"', _configPath);
        logErrorInstance(err);
    }
    return { parsed, error };
};
exports.parseConfig = parseConfig;
const loadConfigFromFile = (path, options = {}) => {
    exports.setConfigPath(exports.getConfigPath(path));
    if (!_configPath) {
        if (!options.silenceErrors) {
            logger.error(`A ${constants_1.DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} file could not be found`);
        }
        else {
            logger.debug(`A ${constants_1.DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} file could not be found`);
        }
        return;
    }
    logger.debug(`Reading config from ${_configPath}`);
    const { source, error: sourceError } = exports.readConfigFile();
    if (sourceError)
        return;
    const { parsed, error: parseError } = exports.parseConfig(source);
    if (parseError)
        return;
    _config = parsed;
    if (!_config) {
        logger.debug('The config file was empty config');
        logger.debug('Initializing an empty config');
        _config = {
            portals: [],
        };
    }
};
exports.loadConfigFromFile = loadConfigFromFile;
const loadConfig = (path, options = {
    useEnv: false,
}) => {
    if (options.useEnv && exports.loadEnvironmentVariableConfig()) {
        logger.debug('Loaded environment variable config');
        environmentVariableConfigLoaded = true;
        return;
    }
    else {
        logger.debug(`Loaded config from ${constants_1.DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME}`);
        exports.loadConfigFromFile(path, options);
    }
};
exports.loadConfig = loadConfig;
const isTrackingAllowed = () => {
    if (!exports.configFileExists() || exports.configFileIsBlank()) {
        return true;
    }
    const { allowUsageTracking } = exports.getAndLoadConfigIfNeeded();
    return allowUsageTracking !== false;
};
exports.isTrackingAllowed = isTrackingAllowed;
const getAndLoadConfigIfNeeded = (options = {}) => {
    if (!_config) {
        exports.loadConfig(null, Object.assign({ silenceErrors: true }, options));
    }
    return _config || {};
};
exports.getAndLoadConfigIfNeeded = getAndLoadConfigIfNeeded;
const getConfigPath = (path) => {
    return path || exports.findConfig(getCwd());
};
exports.getConfigPath = getConfigPath;
const findConfig = (directory) => {
    return findup([
        constants_1.DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
        constants_1.DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME.replace('.yml', '.yaml'),
    ], { cwd: directory });
};
exports.findConfig = findConfig;
const setConfigPath = (path) => {
    return (_configPath = path);
};
exports.setConfigPath = setConfigPath;
const getEnv = (nameOrId) => {
    let env = constants_1.ENVIRONMENTS.PROD;
    const config = exports.getAndLoadConfigIfNeeded();
    const accountId = exports.getAccountId(nameOrId);
    if (accountId) {
        const accountConfig = exports.getAccountConfig(accountId);
        if (accountConfig === null || accountConfig === void 0 ? void 0 : accountConfig.env) {
            env = accountConfig.env;
        }
    }
    else if (config && config.env) {
        env = config.env;
    }
    return env;
};
exports.getEnv = getEnv;
const getAccountConfig = (accountId) => {
    var _a;
    return (_a = exports.getConfigAccounts(exports.getAndLoadConfigIfNeeded())) === null || _a === void 0 ? void 0 : _a.find(account => account.portalId === accountId);
};
exports.getAccountConfig = getAccountConfig;
const getAccountId = (nameOrId) => {
    const config = exports.getAndLoadConfigIfNeeded();
    let name;
    let accountId;
    let account;
    if (!nameOrId) {
        const defaultAccount = exports.getConfigDefaultAccount(config);
        if (defaultAccount) {
            name = defaultAccount;
        }
    }
    else {
        if (typeof nameOrId === 'number') {
            accountId = nameOrId;
        }
        else if (/^\d+$/.test(nameOrId)) {
            accountId = parseInt(nameOrId, 10);
        }
        else {
            name = nameOrId;
        }
    }
    const accounts = exports.getConfigAccounts(config);
    if (name) {
        account = accounts === null || accounts === void 0 ? void 0 : accounts.find(p => p.name === name);
    }
    else if (accountId) {
        account = accounts === null || accounts === void 0 ? void 0 : accounts.find(p => accountId === p.portalId);
    }
    if (account) {
        return account.portalId;
    }
    return null;
};
exports.getAccountId = getAccountId;
const updateAccountConfig = (configOptions) => {
    const { portalId, authType, environment, clientId, clientSecret, scopes, tokenInfo, defaultMode, name, apiKey, personalAccessKey, } = configOptions;
    if (!portalId) {
        throw new Error('An portalId is required to update the config');
    }
    const config = exports.getAndLoadConfigIfNeeded();
    const accountConfig = exports.getAccountConfig(portalId);
    let auth;
    if (clientId || clientSecret || scopes || tokenInfo) {
        auth = Object.assign(Object.assign({}, (accountConfig ? accountConfig.auth : {})), { clientId,
            clientSecret,
            scopes,
            tokenInfo });
    }
    const env = getValidEnv(environment || (accountConfig && accountConfig.env), {
        maskedProductionValue: undefined,
    });
    const mode = defaultMode && defaultMode.toLowerCase();
    const nextAccountConfig = Object.assign(Object.assign(Object.assign(Object.assign({}, accountConfig), { name: name || (accountConfig && accountConfig.name), env }), (portalId && { portalId })), { authType,
        auth,
        apiKey, defaultMode: constants_1.Mode[mode || ''] ? mode : undefined, personalAccessKey });
    let accounts = exports.getConfigAccounts(config) || [];
    if (accountConfig) {
        logger.debug(`Updating config for ${portalId}`);
        const index = accounts === null || accounts === void 0 ? void 0 : accounts.indexOf(accountConfig);
        if (typeof index === 'number' && index !== -1) {
            accounts[index] = nextAccountConfig;
        }
    }
    else {
        logger.debug(`Adding config entry for ${portalId}`);
        if (accounts) {
            accounts.push(nextAccountConfig);
        }
        else {
            accounts = [nextAccountConfig];
        }
    }
    return nextAccountConfig;
};
exports.updateAccountConfig = updateAccountConfig;
const updateDefaultAccount = (defaultAccount) => {
    if (!defaultAccount ||
        (typeof defaultAccount !== 'number' && typeof defaultAccount !== 'string')) {
        throw new Error(`A 'defaultPortal' with value of number or string is required to update the config`);
    }
    const config = exports.getAndLoadConfigIfNeeded();
    config.defaultPortal = defaultAccount;
    exports.setDefaultConfigPathIfUnset();
    exports.writeConfig();
};
exports.updateDefaultAccount = updateDefaultAccount;
const setDefaultConfigPathIfUnset = () => {
    if (!_configPath) {
        exports.setDefaultConfigPath();
    }
};
exports.setDefaultConfigPathIfUnset = setDefaultConfigPathIfUnset;
const setDefaultConfigPath = () => {
    exports.setConfigPath(`${getCwd()}/${constants_1.DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME}`);
};
exports.setDefaultConfigPath = setDefaultConfigPath;
const configFileExists = () => {
    return _configPath && fs_extra_1.default.existsSync(_configPath);
};
exports.configFileExists = configFileExists;
const configFileIsBlank = () => {
    return _configPath && fs_extra_1.default.readFileSync(_configPath).length === 0;
};
exports.configFileIsBlank = configFileIsBlank;
const createEmptyConfigFile = () => {
    exports.setDefaultConfigPathIfUnset();
    if (exports.configFileExists()) {
        return;
    }
    exports.writeConfig({ source: constants_1.EMPTY_CONFIG_FILE_CONTENTS });
};
exports.createEmptyConfigFile = createEmptyConfigFile;
const deleteEmptyConfigFile = () => {
    return (exports.configFileExists() && exports.configFileIsBlank() && fs_extra_1.default.unlinkSync(_configPath));
};
exports.deleteEmptyConfigFile = deleteEmptyConfigFile;
const getConfigVariablesFromEnv = () => {
    const env = process.env;
    return {
        apiKey: env[constants_1.ENVIRONMENT_VARIABLES.HUBSPOT_API_KEY],
        clientId: env[constants_1.ENVIRONMENT_VARIABLES.HUBSPOT_CLIENT_ID],
        clientSecret: env[constants_1.ENVIRONMENT_VARIABLES.HUBSPOT_CLIENT_SECRET],
        personalAccessKey: env[constants_1.ENVIRONMENT_VARIABLES.HUBSPOT_PERSONAL_ACCESS_KEY],
        portalId: parseInt(env[constants_1.ENVIRONMENT_VARIABLES.HUBSPOT_PORTAL_ID] || '', 10),
        refreshToken: env[constants_1.ENVIRONMENT_VARIABLES.HUBSPOT_REFRESH_TOKEN],
        env: getValidEnv(env[constants_1.ENVIRONMENT_VARIABLES.HUBSPOT_ENVIRONMENT]),
    };
};
exports.getConfigVariablesFromEnv = getConfigVariablesFromEnv;
const generatePersonalAccessKeyConfig = (portalId, personalAccessKey, env) => {
    return {
        portals: [
            {
                authType: constants_1.PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
                portalId,
                personalAccessKey,
                env,
            },
        ],
    };
};
exports.generatePersonalAccessKeyConfig = generatePersonalAccessKeyConfig;
const generateOauthConfig = (portalId, clientId, clientSecret, refreshToken, scopes, env) => {
    return {
        portals: [
            {
                authType: constants_1.OAUTH_AUTH_METHOD.value,
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
exports.generateOauthConfig = generateOauthConfig;
const generateApiKeyConfig = (portalId, apiKey, env) => {
    return {
        portals: [
            {
                authType: constants_1.API_KEY_AUTH_METHOD.value,
                portalId,
                apiKey,
                env,
            },
        ],
    };
};
exports.generateApiKeyConfig = generateApiKeyConfig;
const loadConfigFromEnvironment = () => {
    const { apiKey, clientId, clientSecret, personalAccessKey, portalId, refreshToken, env, } = exports.getConfigVariablesFromEnv();
    if (!portalId) {
        return;
    }
    if (personalAccessKey) {
        return exports.generatePersonalAccessKeyConfig(portalId, personalAccessKey, env);
    }
    else if (clientId && clientSecret && refreshToken) {
        return exports.generateOauthConfig(portalId, clientId, clientSecret, refreshToken, constants_1.OAUTH_SCOPES.map(scope => scope.value), env);
    }
    else if (apiKey) {
        return exports.generateApiKeyConfig(portalId, apiKey, env);
    }
    else {
        return;
    }
};
exports.loadConfigFromEnvironment = loadConfigFromEnvironment;
const loadEnvironmentVariableConfig = () => {
    const envConfig = exports.loadConfigFromEnvironment();
    if (!envConfig) {
        return;
    }
    const { portalId } = exports.getConfigVariablesFromEnv();
    logger.debug(`Loaded config from environment variables for account ${portalId}`);
    return exports.setConfig(envConfig);
};
exports.loadEnvironmentVariableConfig = loadEnvironmentVariableConfig;

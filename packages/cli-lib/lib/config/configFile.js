const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const { logger } = require('../../logger');
const {
  logFileSystemErrorInstance,
} = require('../../errorHandlers/fileSystemErrors');
const { logErrorInstance } = require('../../errorHandlers/standardErrors');
const {
  HUBSPOT_CONFIGURATION_FILE,
  HUBSPOT_CONFIGURATION_FOLDER,
} = require('../constants');

const getConfigFilePath = () => {
  return path.join(
    os.homedir(),
    HUBSPOT_CONFIGURATION_FOLDER,
    HUBSPOT_CONFIGURATION_FILE
  );
};

const configFileExists = () => {
  const configPath = getConfigFilePath();
  return configPath && fs.existsSync(configPath);
};

const configFileIsBlank = () => {
  const configPath = getConfigFilePath();
  return configPath && fs.readFileSync(configPath).length === 0;
};

const deleteConfigFile = () => {
  const configPath = getConfigFilePath();
  fs.unlinkSync(configPath);
};

const getOrderedAccount = unorderedAccount => {
  const { name, accountId, env, authType, ...rest } = unorderedAccount;

  return {
    name,
    ...(accountId && { accountId }),
    env,
    authType,
    ...rest,
  };
};

const getOrderedConfig = unorderedConfig => {
  const {
    defaultAccount,
    defaultMode,
    httpTimeout,
    allowUsageTracking,
    accounts,
    ...rest
  } = unorderedConfig;

  return {
    ...(defaultAccount && { defaultAccount }),
    defaultMode,
    httpTimeout,
    allowUsageTracking,
    ...rest,
    accounts: accounts.map(getOrderedAccount),
  };
};

const readConfigFile = configPath => {
  let source;
  let error;

  try {
    source = fs.readFileSync(configPath);
  } catch (err) {
    error = err;
    logger.error(`Config file could not be read: ${configPath}`);
    logFileSystemErrorInstance(err, { filepath: configPath, read: true });
  }
  return { source, error };
};

const parseConfig = configSource => {
  let parsed;
  let error;

  try {
    parsed = yaml.load(configSource);
  } catch (err) {
    error = err;
    logger.error('Config file could not be parsed');
    logErrorInstance(err);
  }
  return { parsed, error };
};

const loadConfigFromFile = options => {
  const configPath = getConfigFilePath();

  if (configPath) {
    const { source, error: readError } = readConfigFile(configPath);

    if (readError) {
      return;
    }
    const { parsed, error: parseError } = parseConfig(source);

    if (parseError) {
      return;
    }
    return parsed;
  }

  const errorFunc = options.silenceErrors ? logger.debug : logger.error;
  errorFunc(`A configuration file could not be found at ${configPath}.`);
  return;
};

/**
 * @param {object}  options
 * @param {string}  options.path
 * @param {string}  options.source
 */
const writeConfigToFile = config => {
  let source;
  try {
    source = yaml.dump(
      JSON.parse(JSON.stringify(getOrderedConfig(config), null, 2))
    );
  } catch (err) {
    logErrorInstance(err);
    return;
  }
  const configPath = getConfigFilePath();

  try {
    fs.ensureFileSync(configPath);
    fs.writeFileSync(configPath, source);
    logger.debug(`Successfully wrote updated config data to ${configPath}`);
  } catch (err) {
    logFileSystemErrorInstance(err, { filepath: configPath, write: true });
  }
};

module.exports = {
  deleteConfigFile,
  configFileExists,
  configFileIsBlank,
  loadConfigFromFile,
  writeConfigToFile,
};

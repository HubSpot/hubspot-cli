const fs = require('fs-extra');
const { logger } = require('@hubspot/cli-lib/logger');
const { MOCK_DATA } = require('./constants');

const getDotEnvConfig = folderPath => {
  const dotEnvPathMaybe = `${folderPath}/.env`;

  if (fs.existsSync(dotEnvPathMaybe)) {
    const loadedConfig = require('dotenv').config({
      path: dotEnvPathMaybe,
    });
    logger.debug(`Loaded .env config from ${dotEnvPathMaybe}.`);
    return loadedConfig;
  }

  return {};
};

const getSecrets = (dotEnvConfig, allowedSecrets) => {
  let secretsDict = {};

  if (dotEnvConfig) {
    allowedSecrets.forEach(secret => {
      if (Object.prototype.hasOwnProperty.call(dotEnvConfig, secret)) {
        secretsDict[secret] = dotEnvConfig[secret];
      }
    });
  }

  return secretsDict;
};

const getMockedDataFromDotEnv = (dotEnvConfig = {}) => {
  let mockedDataDict = {};

  Object.keys(MOCK_DATA).forEach(mockValue => {
    if (Object.prototype.hasOwnProperty.call(dotEnvConfig, mockValue)) {
      mockedDataDict[mockValue] = dotEnvConfig[mockValue];
    }
  });

  return mockedDataDict;
};

const getDotEnvData = (functionPath, allowedSecrets) => {
  const config = getDotEnvConfig(functionPath);

  if (config.error) {
    throw config.error;
  }

  return {
    secrets: getSecrets(config.parsed, allowedSecrets),
    mockData: getMockedDataFromDotEnv(config.parsed),
  };
};

module.exports = {
  getDotEnvData,
};

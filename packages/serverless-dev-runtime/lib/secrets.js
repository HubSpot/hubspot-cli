const fs = require('fs-extra');
const { logger } = require('@hubspot/cms-lib/logger');
const { MOCK_DATA } = require('./constants');

const loadDotEnvFile = folderPath => {
  const dotEnvPathMaybe = `${folderPath}/.env`;

  if (fs.existsSync(dotEnvPathMaybe)) {
    const loadedConfig = require('dotenv').config({ path: dotEnvPathMaybe });
    logger.debug(`Loaded .env config from ${dotEnvPathMaybe}.`);
    return loadedConfig;
  }

  return {};
};

const getSecrets = (functionPath, secrets) => {
  const config = loadDotEnvFile(functionPath);
  let secretsDict = {};

  if (config.error) {
    throw config.error;
  }

  secrets.forEach(secret => {
    if (Object.prototype.hasOwnProperty.call(process.env, secret)) {
      secretsDict[secret] = process.env[secret];
    }
  });

  return secretsDict;
};

const getMockedDataFromDotEnv = functionPath => {
  const config = loadDotEnvFile(functionPath);
  let mockedDataDict = {};

  if (config.error) {
    throw config.error;
  }

  Object.keys(MOCK_DATA).forEach(mockValue => {
    if (Object.prototype.hasOwnProperty.call(process.env, mockValue)) {
      mockedDataDict[mockValue] = process.env[mockValue];
    }
  });

  return mockedDataDict;
};

module.exports = {
  loadDotEnvFile,
  getMockedDataFromDotEnv,
  getSecrets,
};

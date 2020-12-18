const fs = require('fs-extra');
const { logger } = require('@hubspot/cms-lib/logger');
const { DEFAULTS } = require('./constants');

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

  secrets.concat(Object.keys(DEFAULTS)).forEach(secret => {
    if (Object.prototype.hasOwnProperty.call(process.env, secret)) {
      secretsDict[secret] = process.env[secret];
    }
  });

  return secretsDict;
};

module.exports = {
  loadDotEnvFile,
  getSecrets,
};

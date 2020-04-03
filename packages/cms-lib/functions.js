const path = require('path');
const fs = require('fs-extra');
const findup = require('findup-sync');
const { logger } = require('./logger');
const { logFileSystemErrorInstance } = require('./errorHandlers');
const isObject = require('./lib/isObject');

const functionBody = `
exports.main = ({}, sendResponse) => {
  sendResponse({
    body: {
      message: 'Hello, world!',
    },
  });
};
`;

function createEndpoint(endpointMethod, filename) {
  return {
    method: endpointMethod || 'GET',
    file: filename,
  };
}

function createConfig({ endpointPath, endpointMethod, filename }) {
  return {
    runtime: 'nodejs12.x',
    version: '1.0',
    environment: {},
    secrets: [],
    endpoints: {
      [endpointPath]: createEndpoint(endpointMethod, filename),
    },
  };
}

function writeConfig(configFilePath, config) {
  const configJson = JSON.stringify(config, null, '  ');
  fs.writeFileSync(configFilePath, configJson);
}

function updateExistingConfig(
  configFilePath,
  { endpointPath, endpointMethod, filename }
) {
  let config;
  try {
    config = fs.readFileSync(configFilePath).toString();
  } catch (err) {
    logger.error(`The file "${configFilePath}" could not be read`);
    logFileSystemErrorInstance(err, { filepath: configFilePath, read: true });
  }
  config = JSON.parse(config);

  if (isObject(config)) {
    if (config.endpoints) {
      if (config.endpoints[endpointPath]) {
        logger.error(
          `The endpoint "${endpointPath}" already exists in "${configFilePath}"`
        );
        return false;
      } else {
        config.endpoints[endpointPath] = createEndpoint(
          endpointMethod,
          filename
        );
      }
    } else {
      config.endpoints = {
        [endpointPath]: createEndpoint(endpointMethod, filename),
      };
    }
    writeConfig(configFilePath, config);
    return true;
  }
  logger.error(`The existing "${configFilePath}" is not an object`);
  return false;
}

function createFunction(
  { functionsFolder, filename, endpointPath, endpointMethod },
  dest
) {
  const ancestorFunctionsDir = findup('*.functions');

  if (ancestorFunctionsDir) {
    logger.error(
      `Cannot create a functions directory inside ${ancestorFunctionsDir}`
    );
    return;
  }

  const folderName = functionsFolder.endsWith('.functions')
    ? functionsFolder
    : `${functionsFolder}.functions`;
  const functionFile = filename.endsWith('.js') ? filename : `${filename}.js`;

  const destPath = path.join(dest, folderName);
  if (fs.existsSync(destPath)) {
    logger.log(`The ${destPath} path already exists`);
  } else {
    fs.mkdirp(destPath);
    logger.log(`Created ${destPath}`);
  }
  const functionFilePath = path.join(destPath, functionFile);
  const configFilePath = path.join(destPath, 'serverless.json');

  if (fs.existsSync(functionFilePath)) {
    logger.error(`The JavaScript file at ${functionFilePath} already exists`);
    return;
  }

  fs.writeFileSync(functionFilePath, functionBody);
  logger.log(`Created ${functionFilePath}`);

  if (fs.existsSync(configFilePath)) {
    const updated = updateExistingConfig(configFilePath, {
      endpointPath,
      endpointMethod,
      filename,
    });
    if (updated) {
      logger.log(
        `A function for the endpoint /_hcms/api/${endpointPath} has been created`
      );
    } else {
      logger.error('The function could not be created');
    }
  } else {
    const config = createConfig({ endpointPath, endpointMethod, functionFile });
    writeConfig(configFilePath, config);
    logger.log(`Created ${configFilePath}`);
    logger.log(
      `A function for the endpoint /_hcms/api/${endpointPath} has been created`
    );
  }
}

module.exports = {
  createFunction,
};

const path = require('path');
const fs = require('fs-extra');
const findup = require('findup-sync');
const { logger } = require('./logger');
const { logFileSystemErrorInstance } = require('./errorHandlers');
const isObject = require('./lib/isObject');
const { getCwd } = require('./path');

const functionBody = `
// Require axios library to make API requests
const axios = require('axios');

// This function is executed when a request is made to the endpoint associated with this file in the serverless.json file
exports.main = ({ accountId }, sendResponse) => {
  // Use axios to make a GET request to the search API
  axios
    .get('https://api.hubapi.com/contentsearch/v2/search', {
      params: {
        portalId: accountId,
        term: 'searchTerm',
      },
    })
    .then(function(response) {
      // Handle success
      // The console.log statement will appear in the terminal when you run the hs logs CLI command
      // For full documentation, see: developers.hubspot.com/docs/cms/developer-reference/local-development-cms-cli#logs
      console.log('Data received from the search API:', response.data);
      // sendResponse is what you will send back to services hitting your serverless function
      sendResponse({ body: { response: response.data }, statusCode: 200 });
    })
    .catch(function(error) {
      // Handle error

      // This is a simple example; error handling typically will be more complicated.
      // For more information on error handling with axios, see: https://github.com/axios/axios#handling-errors
      sendResponse({ body: { error: error.message }, statusCode: 500 });
    });
};
`.trim();

function createEndpoint(endpointMethod, filename) {
  return {
    method: endpointMethod || 'GET',
    file: filename,
  };
}

function createConfig({ endpointPath, endpointMethod, functionFile }) {
  return {
    runtime: 'nodejs18.x',
    version: '1.0',
    environment: {},
    secrets: [],
    endpoints: {
      [endpointPath]: createEndpoint(endpointMethod, functionFile),
    },
  };
}

function writeConfig(configFilePath, config) {
  const configJson = JSON.stringify(config, null, '  ');
  fs.writeFileSync(configFilePath, configJson);
}

function updateExistingConfig(
  configFilePath,
  { endpointPath, endpointMethod, functionFile }
) {
  let config;
  try {
    config = fs.readFileSync(configFilePath).toString();
  } catch (err) {
    logger.error(`The file "${configFilePath}" could not be read`);
    logFileSystemErrorInstance(err, { filepath: configFilePath, read: true });
  }

  try {
    config = JSON.parse(config);
  } catch (err) {
    logger.error(`The file "${configFilePath}" is not valid JSON`);
    return false;
  }

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
          functionFile
        );
      }
    } else {
      config.endpoints = {
        [endpointPath]: createEndpoint(endpointMethod, functionFile),
      };
    }
    try {
      writeConfig(configFilePath, config);
    } catch (err) {
      logger.error(`The file "${configFilePath}" could not be updated`);
      logFileSystemErrorInstance(err, {
        filepath: configFilePath,
        write: true,
      });
      return false;
    }
    return true;
  }
  logger.error(`The existing "${configFilePath}" is not an object`);
  return false;
}

function createFunction(
  { functionsFolder, filename, endpointPath, endpointMethod },
  dest,
  options = {
    allowExistingFile: false,
  }
) {
  const ancestorFunctionsConfig = findup('serverless.json', {
    cwd: getCwd(),
    nocase: true,
  });

  if (ancestorFunctionsConfig) {
    logger.error(
      `Cannot create a functions directory inside "${path.dirname(
        ancestorFunctionsConfig
      )}"`
    );
    return;
  }

  const folderName = functionsFolder.endsWith('.functions')
    ? functionsFolder
    : `${functionsFolder}.functions`;
  const functionFile = filename.endsWith('.js') ? filename : `${filename}.js`;

  const destPath = path.join(dest, folderName);
  if (fs.existsSync(destPath)) {
    logger.log(`The "${destPath}" path already exists`);
  } else {
    fs.mkdirp(destPath);
    logger.log(`Created "${destPath}"`);
  }
  const functionFilePath = path.join(destPath, functionFile);
  const configFilePath = path.join(destPath, 'serverless.json');

  if (!options.allowExistingFile && fs.existsSync(functionFilePath)) {
    logger.error(`The JavaScript file at "${functionFilePath}" already exists`);
    return;
  }

  try {
    fs.writeFileSync(functionFilePath, functionBody);
  } catch (err) {
    logger.error(`The file "${functionFilePath}" could not be created`);
    logFileSystemErrorInstance(err, {
      filepath: functionFilePath,
      write: true,
    });
    return;
  }

  logger.log(`Created "${functionFilePath}"`);

  if (fs.existsSync(configFilePath)) {
    const updated = updateExistingConfig(configFilePath, {
      endpointPath,
      endpointMethod,
      functionFile,
    });
    if (updated) {
      logger.success(
        `A function for the endpoint "/_hcms/api/${endpointPath}" has been created. Upload "${folderName}" to try it out`
      );
    } else {
      logger.error('The function could not be created');
    }
  } else {
    const config = createConfig({ endpointPath, endpointMethod, functionFile });
    try {
      writeConfig(configFilePath, config);
    } catch (err) {
      logger.error(`The file "${configFilePath}" could not be created`);
      logFileSystemErrorInstance(err, {
        filepath: configFilePath,
        write: true,
      });
      return;
    }
    logger.log(`Created "${configFilePath}"`);
    logger.success(
      `A function for the endpoint "/_hcms/api/${endpointPath}" has been created. Upload "${folderName}" to try it out`
    );
  }
}

module.exports = {
  createFunction,
};

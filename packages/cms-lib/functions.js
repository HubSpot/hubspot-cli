const path = require('path');
const fs = require('fs-extra');
const { logger } = require('./logger');

const functionBody = `
exports.main = ({}, sendResponse) => {
  sendResponse({
    body: {
      message: 'Hello, world!',
    },
  });
};
`;

function createConfig(endpointPath, endpointMethod, filename) {
  return {
    runtime: 'nodejs12.x',
    version: '1.0',
    environment: {},
    secrets: [],
    endpoints: {
      [endpointPath]: {
        method: endpointMethod || 'GET',
        file: filename,
      },
    },
  };
}

function createFunction(
  { functionsFolder, filename, endpointPath, endpointMethod },
  dest
) {
  const folderName = functionsFolder.endsWith('.functions')
    ? functionsFolder
    : `${functionsFolder}.functions`;
  const functionFile = filename.endsWith('.js') ? filename : `${filename}.js`;

  const destPath = path.join(dest, folderName);
  if (fs.existsSync(destPath)) {
    logger.error(`The ${destPath} path already exists`);
    return;
  }
  logger.log(`Creating ${destPath}`);
  fs.mkdirp(destPath);

  const config = createConfig(endpointPath, endpointMethod, functionFile);
  const configJson = JSON.stringify(config, null, '  ');
  fs.writeFileSync(path.join(destPath, 'serverless.json'), configJson);

  fs.writeFileSync(path.join(destPath, functionFile), functionBody);
}

module.exports = {
  createFunction,
};

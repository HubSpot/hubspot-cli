const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const chalk = require('chalk');
const { logger } = require('@hubspot/cms-lib/logger');
const {
  logErrorInstance,
} = require('@hubspot/cms-lib/errorHandlers/standardErrors');

const { validateInputs } = require('./validation');
const { getValidatedFunctionData } = require('./data');
const { setupRoutes } = require('./routes');
const { createTemporaryFunction, cleanupArtifacts } = require('./files');
const { getTableContents, getTableHeader } = require('./table');
const { DEFAULTS } = require('./constants');
const { watch } = require('./watch');

let connections = [];
let isRestarting = false;
let tmpDir;
let currentServer;
let options;

const installMiddleware = app => {
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(cors());
};

const configure = app => {
  app.set('trust proxy', true);
};

const shutdownServer = (server, callback) => {
  logger.debug(`Clearing ${connections.length} active server connections.`);
  connections.forEach(connection => {
    if (connection.destroyed === false) {
      connection.destroy();
    }
  });

  connections = [];

  logger.debug('Closing server.');
  return server.close(callback);
};

const runTestServer = async callback => {
  const { accountId, path: functionPath, port } = options;
  const validatedFunctionData = getValidatedFunctionData(functionPath);

  if (!validatedFunctionData) {
    process.exit();
  }

  const {
    endpoints,
    routes,
    environment: globalEnvironment,
    tmpDir: temporaryDir,
    secrets,
  } = await createTemporaryFunction(validatedFunctionData);
  tmpDir = temporaryDir;

  const app = express();
  installMiddleware(app);
  configure(app);
  setupRoutes(
    app,
    routes,
    endpoints,
    tmpDir,
    accountId,
    globalEnvironment,
    secrets,
    options
  );

  currentServer = app.listen(port, () => {
    const testServerPath = `http://localhost:${port}`;
    logger.log(`Local test server running at ${testServerPath}`);
    const envVarsForMockedData = Object.keys(DEFAULTS);
    const functionsAsArrays = routes.map(route => {
      const { method, environment: localEnvironment } = endpoints[route];
      return [
        `${testServerPath}/${route}`,
        method.join(', '),
        secrets.join(', '),
        Object.keys(localEnvironment)
          .map(envVar => {
            return envVarsForMockedData.indexOf(envVar) === -1
              ? envVar
              : chalk.keyword('orange')(envVar);
          })
          .join(', '),
      ];
    });
    functionsAsArrays.unshift(
      getTableHeader([
        'Endpoint',
        'Methods',
        'Secrets',
        'Environment Variables',
      ])
    );

    if (typeof callback === 'function') {
      callback(currentServer);
    }

    return logger.log(getTableContents(functionsAsArrays));
  });

  currentServer.on('connection', connection => {
    connections.push(connection);
    connection.on('close', connection => {
      connections = connections.filter(curr => curr !== connection);
    });
  });

  let hasBeenRestarted = false;
  const onSigInt = () => {
    if (!hasBeenRestarted) {
      shutdownServer(currentServer);
      cleanupArtifacts(tmpDir.name);
      logger.info('Local function test server closed.');
      process.exit();
    }
  };

  process.on('SIGINT', onSigInt);

  return currentServer;
};

const restartServer = (event, filePath) => {
  if (!isRestarting) {
    isRestarting = true;
    logger.log(
      `Restarting Server: Changes detected in ${filePath}.`,
      currentServer
    );
    return shutdownServer(currentServer, () => {
      cleanupArtifacts(tmpDir.name);
      return startServer(() => {
        isRestarting = false;
      });
    });
  }
};

const startServer = async callback => {
  const { accountId, path: functionPath, port } = options;
  validateInputs(options);

  try {
    await runTestServer(callback);
  } catch (e) {
    logErrorInstance(e, {
      port,
      accountId,
      functionPath,
    });
  }
};

const start = async props => {
  options = props;
  const { path: functionPath } = options;
  watch(functionPath, restartServer);
  startServer();
};

module.exports = {
  start,
};

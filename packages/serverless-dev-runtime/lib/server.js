const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const chalk = require('chalk');
const { logger, setLogLevel, LOG_LEVEL } = require('@hubspot/cli-lib/logger');
const {
  logErrorInstance,
} = require('@hubspot/cli-lib/errorHandlers/standardErrors');
const {
  getTableContents,
  getTableHeader,
} = require('@hubspot/cli-lib/lib/table');

const { validateInputs } = require('./validation');
const { getValidatedFunctionData } = require('./data');
const { setupRoutes, updateRoutePaths } = require('./routes');
const { createTemporaryFunction, cleanupArtifacts } = require('./files');
const {
  MOCK_DATA,
  MAX_REQ_BODY_SIZE,
  SERVERLESS_FUNCTION_TYPES,
} = require('./constants');
const { watch: watchFolder } = require('./watch');

let connections = [];
let isRestarting = false;
let tmpDir;
let currentServer;
let options;

const setOptions = optionsData => {
  if (optionsData.contact === undefined) {
    optionsData.contact = true;
  }
  options = optionsData;
};

const installMiddleware = app => {
  app.use(bodyParser.json({ limit: MAX_REQ_BODY_SIZE }));
  app.use(bodyParser.urlencoded({ limit: MAX_REQ_BODY_SIZE, extended: true }));
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
    routes: rawRoutes,
    environment: globalEnvironment,
    tmpDir: temporaryDir,
    secrets,
  } = await createTemporaryFunction(validatedFunctionData);
  const routes = updateRoutePaths(rawRoutes);
  tmpDir = temporaryDir;

  const app = express();
  installMiddleware(app);
  configure(app);
  setupRoutes({
    app,
    routes,
    functionPath,
    tmpDir,
    accountId,
    globalEnvironment,
    secrets,
    options,
  });

  currentServer = app.listen(port, () => {
    const testServerPath = `http://localhost:${port}`;
    logger.log(`Local test server running at ${testServerPath}`);
    logger.debug(`directory is available at ${tmpDir.name}`);
    const envVarsForMockedData = Object.keys(MOCK_DATA);
    const functionsAsArrays = routes.map(route => {
      const { method = 'GET', environment: localEnvironment } =
        route.type === SERVERLESS_FUNCTION_TYPES.APP_FUNCTION
          ? route.appFunction
          : route.endpoint;

      const environmentVariables =
        (localEnvironment &&
          Object.keys(localEnvironment)
            .map(envVar => {
              return envVarsForMockedData.indexOf(envVar) === -1
                ? envVar
                : chalk.hex('#FFA500')(envVar);
            })
            .join(', ')) ||
        [];

      return [
        `${testServerPath}/${route.url}`,
        typeof method === 'string' ? method : method.join(', '),
        secrets.join(', '),
        environmentVariables,
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
      process.exit();
    }
  };

  process.on('SIGINT', onSigInt);

  return currentServer;
};

const restartServer = (event, filePath) => {
  if (!isRestarting) {
    isRestarting = true;
    logger.info(`Restarting Server: Changes detected in ${filePath}.`);
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
    const currentServer = await runTestServer(callback);
    return {
      server: currentServer,
      exit: callback => {
        return shutdownServer(currentServer, callback);
      },
    };
  } catch (e) {
    logErrorInstance(e, {
      port,
      accountId,
      functionPath,
    });
  }
};

const start = props => {
  setOptions(props);
  const { path: functionPath, watch, debug } = options;
  setLogLevel(debug ? LOG_LEVEL.DEBUG : LOG_LEVEL.LOG);
  if (watch) {
    watchFolder(functionPath, restartServer);
  }
  return startServer();
};

module.exports = {
  start,
};

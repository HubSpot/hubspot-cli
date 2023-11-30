const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const chalk = require('chalk');
const { logger, setLogLevel, LOG_LEVEL } = require('@hubspot/cli-lib/logger');
const {
  getTableContents,
  getTableHeader,
} = require('@hubspot/local-dev-lib/logging/table');

const { validateInputs } = require('./validation');
const { getValidatedFunctionData } = require('./data');
const { setupRoutes, updateRoutePaths } = require('./routes');
const { createTemporaryFunction, cleanupArtifacts } = require('./files');
const {
  MOCK_DATA,
  ROUTE_PATH_PREFIX,
  MAX_REQ_BODY_SIZE,
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
    endpoints,
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
    endpoints,
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
    const envVarsForMockedData = Object.keys(MOCK_DATA);
    const functionsAsArrays = routes.map(route => {
      const rawRoute = route.replace(ROUTE_PATH_PREFIX, '');
      const { method, environment: localEnvironment } = endpoints[rawRoute];
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
        `${testServerPath}/${route}`,
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
    logger.error(`A system error has occurred: ${e.message}`);
    logger.debug(e);
    logger.debug({
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

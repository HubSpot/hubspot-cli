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

const installMiddleware = app => {
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(cors());
};

const configure = app => {
  app.set('trust proxy', true);
};

const shutdownServer = (server, callback) => {
  connections.forEach(connection => {
    if (connection.destroyed === false) {
      connection.destroy();
    }
  });

  server.close(callback);
};

const runTestServer = async options => {
  const { accountId, path: functionPath, port } = options;
  const validatedFunctionData = getValidatedFunctionData(functionPath);

  if (!validatedFunctionData) {
    process.exit();
  }

  const {
    endpoints,
    routes,
    environment: globalEnvironment,
    tmpDir,
    secrets,
  } = await createTemporaryFunction(validatedFunctionData);

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

  const localFunctionTestServer = app.listen(port, () => {
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
    return logger.log(getTableContents(functionsAsArrays));
  });

  localFunctionTestServer.on('connection', connection => {
    connections.push(connection);
    connection.on('close', connection => {
      connections = connections.filter(curr => curr !== connection);
    });
  });

  let wasRestarted = false;
  const onSigInt = () => {
    if (!wasRestarted) {
      shutdownServer(localFunctionTestServer);
      cleanupArtifacts(tmpDir.name);
      logger.info('Local function test server closed.');
      process.exit();
    }
  };
  const restart = getRestart(options, tmpDir, localFunctionTestServer);

  process.on('SIGINT', onSigInt);

  watch(functionPath, () => {
    wasRestarted = true;
    restart();
  });
};

const getRestart = (options, tmpDir, server) => {
  return (event, filePath) => {
    logger.log(`Restarting Server: Changes detected to ${filePath}.`);
    shutdownServer(server, () => {
      cleanupArtifacts(tmpDir.name);
      start(options);
    });
  };
};

const start = async options => {
  const { accountId, path: functionPath, port } = options;
  validateInputs(options);

  try {
    await runTestServer(options);
  } catch (e) {
    logErrorInstance(e, {
      port,
      accountId,
      functionPath,
    });
  }
};

module.exports = {
  start,
};

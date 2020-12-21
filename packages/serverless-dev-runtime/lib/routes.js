const path = require('path');
const fs = require('fs-extra');
const { logger } = require('@hubspot/cms-lib/logger');
const { getFunctionDataContext } = require('./data');
const { loadEnvironmentVariables } = require('./environment');
const { logFunctionExecution } = require('./logging');

const addEndpointToApp = (
  app,
  method,
  route,
  functionPath,
  file,
  accountId,
  globalEnvironment,
  localEnvironment,
  secrets,
  options
) => {
  logger.debug(
    `Setting up route: ${route} to run function ${functionPath}/${file}.`
  );
  const { contact } = options;
  app[method.toLowerCase()](`/${route}`, async (req, res) => {
    const startTime = Date.now();
    const functionFilePath = path.resolve(`${functionPath}/${file}`);
    if (!fs.existsSync(functionFilePath)) {
      logger.error(`Could not find file ${functionPath}/${file}.`);
      return;
    }
    const { main } = require(functionFilePath);

    if (!main) {
      logger.error(`Could not find "main" export in ${functionPath}/${file}.`);
    }

    const originalConsoleLog = console.log;
    const trackedLogs = [];

    try {
      loadEnvironmentVariables(globalEnvironment, localEnvironment);
      const dataForFunc = await getFunctionDataContext(
        req,
        functionPath,
        secrets,
        accountId,
        contact
      );

      console.log = (...args) => {
        trackedLogs.push(args);
      };

      await main(dataForFunc, sendResponseValue => {
        const endTime = Date.now();

        console.log = originalConsoleLog;
        logFunctionExecution('SUCCESS', sendResponseValue, startTime, endTime);
        trackedLogs.forEach(trackedLog => {
          console.log(...trackedLog);
        });
        res.json(sendResponseValue);
      });
    } catch (e) {
      const endTime = Date.now();
      console.log = originalConsoleLog;
      logFunctionExecution('UNHANDLED_ERROR', startTime, endTime);
      trackedLogs.forEach(trackedLog => {
        console.log(...trackedLog);
      });
      res.json(e);
    }
  });
};

const setupRoutes = (
  app,
  routes,
  endpoints,
  tmpDir,
  accountId,
  globalEnvironment,
  secrets,
  options
) => {
  routes.forEach(route => {
    const { method, file, environment: localEnvironment } = endpoints[route];

    if (Array.isArray(method)) {
      method.forEach(methodType => {
        addEndpointToApp(
          app,
          methodType,
          route,
          tmpDir.name,
          file,
          accountId,
          globalEnvironment,
          localEnvironment,
          secrets,
          options
        );
      });
    } else {
      addEndpointToApp(
        app,
        method,
        route,
        tmpDir.name,
        file,
        accountId,
        globalEnvironment,
        localEnvironment,
        secrets,
        options
      );
    }
  });
};

module.exports = {
  setupRoutes,
};

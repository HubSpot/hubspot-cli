const path = require('path');
const fs = require('fs-extra');
const { logger } = require('@hubspot/cms-lib/logger');
const { getFunctionDataContext } = require('./data');
const { loadEnvironmentVariables } = require('./environment');
const { logFunctionExecution } = require('./logging');

const outputTrackedLogs = trackedLogs => {
  trackedLogs.forEach(trackedLog => {
    logger.log(...trackedLog);
  });
};

const addEndpointToApp = endpointData => {
  const {
    app,
    method,
    route,
    functionPath,
    tmpDir: { name: tmpDirName },
    file,
    accountId,
    globalEnvironment,
    localEnvironment,
    secrets,
    options,
  } = endpointData;
  logger.debug(
    `Setting up route: ${route} to run function ${functionPath}/${file}.`
  );
  const { contact } = options;

  if (!method) {
    logger.error(`No method was specified for route "${route}"`);
    process.exit();
  }

  if (!file) {
    logger.error(`No file was specified for route "${route}"`);
    process.exit();
  }

  app[method.toLowerCase()](`/${route}`, async (req, res) => {
    const startTime = Date.now();
    const functionFilePath = path.resolve(`${tmpDirName}/${file}`);
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
        tmpDirName,
        secrets,
        accountId,
        contact
      );

      // Capture anything logged within the serverless function
      // for output later. Placement of this code matters!
      console.log = (...args) => {
        trackedLogs.push(args);
      };

      await main(dataForFunc, sendResponseValue => {
        const endTime = Date.now();
        console.log = originalConsoleLog;
        logFunctionExecution('SUCCESS', sendResponseValue, startTime, endTime);
        outputTrackedLogs(trackedLogs);
        res.json(sendResponseValue);
      });
    } catch (e) {
      const endTime = Date.now();
      console.log = originalConsoleLog;
      logFunctionExecution('UNHANDLED_ERROR', startTime, endTime);
      outputTrackedLogs(trackedLogs);
      res.json(e);
    }
  });
};

const setupRoutes = routeData => {
  const { routes, endpoints } = routeData;

  routes.forEach(route => {
    const { method, file, environment: localEnvironment } = endpoints[route];

    if (Array.isArray(method)) {
      method.forEach(methodType => {
        addEndpointToApp({
          ...routeData,
          method: methodType,
          route,
          file,
          localEnvironment,
        });
      });
    } else {
      addEndpointToApp({
        ...routeData,
        method,
        route,
        file,
        localEnvironment,
      });
    }
  });
};

module.exports = {
  setupRoutes,
};

const path = require('path');
const util = require('util');
const fs = require('fs-extra');
const { logger } = require('@hubspot/cli-lib/logger');
const { commaSeparatedValues } = require('@hubspot/local-dev-lib/text');
const { getFunctionDataContext } = require('./data');
const { loadEnvironmentVariables } = require('./environment');
const { logFunctionExecution } = require('./logging');
const { ALLOWED_METHODS, ROUTE_PATH_PREFIX } = require('./constants');

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
  } else if (ALLOWED_METHODS.indexOf(method) === -1) {
    logger.error(
      `Invalid method "${method}" for route "${route}". Allowed values are ${commaSeparatedValues(
        ALLOWED_METHODS
      )}`
    );
    process.exit();
  }

  if (!file) {
    logger.error(`No file was specified for route "${route}"`);
    process.exit();
  }
  const formattedRoute = `/${route}`;

  app[method.toLowerCase()](formattedRoute, async (req, res) => {
    const startTime = Date.now();
    const dataForFunc = await getFunctionDataContext(
      req,
      tmpDirName,
      secrets,
      accountId,
      contact
    );
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

      // Capture anything logged within the serverless function
      // for output later. Placement of this code matters!
      console.log = (...args) => {
        trackedLogs.push(args);
      };
      const functionExecutionCallback = sendResponseValue => {
        const { statusCode, body, headers = {} } = sendResponseValue;
        const endTime = Date.now();
        const memoryUsed = process.memoryUsage().heapUsed / 1024 / 1024;
        console.log = originalConsoleLog;

        if (statusCode === 500) {
          logFunctionExecution({
            status: 'ERROR',
            payload: body,
            startTime,
            endTime,
            memoryUsed,
            options: {
              insertions: {
                header: `${method} ${formattedRoute}`,
              },
            },
          });
          outputTrackedLogs(trackedLogs);
          res.end();
          return;
        }

        logFunctionExecution({
          status: 'SUCCESS',
          payload: body,
          startTime,
          endTime,
          memoryUsed,
          options: {
            insertions: {
              header: `${method} ${formattedRoute}`,
            },
          },
        });

        if (options.logOutput) {
          logger.log(
            util.inspect(body, {
              colors: true,
              compact: true,
              depth: 'Infinity',
            })
          );
        }

        outputTrackedLogs(trackedLogs);

        if (statusCode) {
          res.status(statusCode);
        }
        res.set(headers).send(body);
      };

      await main(dataForFunc, functionExecutionCallback);
    } catch (e) {
      console.log = originalConsoleLog;
      logger.error(e);
      res.status(500).send(e);
    }
  });
};

const updateRoutePaths = routes => {
  return routes.map(route => {
    return `${ROUTE_PATH_PREFIX}${route}`;
  });
};

const setupRoutes = routeData => {
  const { routes, endpoints } = routeData;

  routes.forEach(route => {
    const rawRoute = route.replace(ROUTE_PATH_PREFIX, '');
    const { method, file, environment: localEnvironment } = endpoints[rawRoute];

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
  updateRoutePaths,
};

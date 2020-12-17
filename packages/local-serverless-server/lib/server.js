const path = require('path');
const express = require('express');
const fs = require('fs-extra');
const bodyParser = require('body-parser');
const cors = require('cors');
const { logger } = require('@hubspot/cms-lib/logger');
const {
  logErrorInstance,
} = require('@hubspot/cms-lib/errorHandlers/standardErrors');

// Future
// const { validateInputs } = require('./lib/validation');

const { getValidatedFunctionData } = require('./data');
const { loadEnvironmentVariables } = require('./environment');
const { getSecrets } = require('./secrets');
const { logFunctionExecution } = require('./logging');
const { createTemporaryFunction, cleanupArtifacts } = require('./files');
const { getTableContents, getTableHeader } = require('./table');
const { DEFAULTS } = require('./constants');

const getHeaders = req => {
  const reqHeaders = req.headers;

  return {
    Accept: reqHeaders.accept,
    'Accept-Encoding': reqHeaders['accept-encoding'],
    'Accept-Language': reqHeaders['accept-language'],
    'Cache-Control': reqHeaders['cache-control'],
    Connection: reqHeaders.connection,
    Cookie: reqHeaders.cookie,
    Host: reqHeaders.host,
    'True-Client-IP': req.ip, // https://stackoverflow.com/a/14631683/3612910
    'upgrade-insecure-requests': reqHeaders['upgrade-insecure-requests'],
    'User-Agent': reqHeaders['user-agent'],
    'X-Forwarded-For':
      req.headers['x-forwarded-for'] || req.connection.remoteAddress, // https://stackoverflow.com/a/14631683/3612910
  };
};

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
    console.log = log => {
      trackedLogs.push(log);
    };

    try {
      loadEnvironmentVariables(globalEnvironment, localEnvironment);
      const {
        HUBSPOT_LIMITS_TIME_REMAINING,
        HUBSPOT_LIMITS_EXECUTIONS_REMAINING,
        HUBSPOT_CONTACT_VID,
        HUBSPOT_CONTACT_IS_LOGGED_IN,
        HUBSPOT_CONTACT_LIST_MEMBERSHIPS,
      } = process.env;
      const dataForFunc = {
        secrets: await getSecrets(functionPath, secrets),
        params: req.query,
        limits: {
          timeRemaining:
            HUBSPOT_LIMITS_TIME_REMAINING ||
            DEFAULTS.HUBSPOT_LIMITS_TIME_REMAINING,
          executionsRemaining:
            HUBSPOT_LIMITS_EXECUTIONS_REMAINING ||
            DEFAULTS.HUBSPOT_LIMITS_EXECUTIONS_REMAINING,
        },
        body: req.body,
        headers: getHeaders(req),
        accountId,
        contact: options.contact
          ? {
              vid:
                parseInt(HUBSPOT_CONTACT_VID, 10) ||
                DEFAULTS.HUBSPOT_CONTACT_VID,
              isLoggedIn:
                HUBSPOT_CONTACT_IS_LOGGED_IN ||
                DEFAULTS.HUBSPOT_CONTACT_IS_LOGGED_IN,
              listMemberships:
                (HUBSPOT_CONTACT_LIST_MEMBERSHIPS.length &&
                  HUBSPOT_CONTACT_LIST_MEMBERSHIPS.split(',')) ||
                DEFAULTS.HUBSPOT_CONTACT_LIST_MEMBERSHIPS,
            }
          : null,
      };

      await main(dataForFunc, sendResponseValue => {
        const endTime = Date.now();

        console.log = originalConsoleLog;
        logFunctionExecution(
          'SUCCESS',
          sendResponseValue,
          startTime,
          endTime,
          trackedLogs
        );
        res.json(sendResponseValue);
      });
    } catch (e) {
      const endTime = Date.now();
      console.log = originalConsoleLog;
      logFunctionExecution('UNHANDLED_ERROR', startTime, endTime, trackedLogs);
      res.json(e);
    }
  });
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
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(cors());
  app.set('trust proxy', true);

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

  const localFunctionTestServer = app.listen(port, () => {
    const testServerPath = `http://localhost:${port}`;
    logger.log(`Local test server running at ${testServerPath}`);
    const functionsAsArrays = routes.map(route => {
      const { method, environment: localEnvironment } = endpoints[route];
      return [
        `${testServerPath}/${route}`,
        method.join(', '),
        secrets.join(', '),
        Object.keys(localEnvironment).join(', '),
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

  process.on('SIGINT', () => {
    localFunctionTestServer.close();
    logger.info('Local function test server closed.');
    cleanupArtifacts(tmpDir.name);
    process.exit();
  });
};

// const installMiddleware = app => {
//   app.use(bodyParser.urlencoded({ extended: true }));
//   app.use(cors());
// };

// const configure = app => {
//   app.set('trust proxy', true);
// };

const start = async options => {
  const { accountId, path: functionPath, port } = options;
  // validateInputs(options);
  // const app = express();
  // installMiddleware(app);
  // configure(app);

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

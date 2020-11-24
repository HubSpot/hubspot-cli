const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const util = require('util');
const tmp = require('tmp');
const { spawn } = require('child_process');
const os = require('os');
const { performance } = require('perf_hooks');
const bodyParser = require('body-parser');
const {
  addAccountOptions,
  addConfigOptions,
  setLogLevel,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logDebugInfo } = require('../../lib/debugInfo');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { validateAccount } = require('../../lib/validation');
const defaultFunctionPackageJson = require('../../lib/templates/default-function-package.json');
const {
  logErrorInstance,
} = require('@hubspot/cms-lib/errorHandlers/standardErrors');

const MAX_SECRETS = 50;
const MAX_DEPS = 3;
const MAX_RUNTIME = 3000;
// AWS does not allow overriding these
// https://docs.aws.amazon.com/lambda/latest/dg/current-supported-versions.html#lambda-environment-variables
const AWS_RESERVED_VARS = [
  '_HANDLER',
  'LAMBDA_TASK_ROOT',
  'LAMBDA_RUNTIME_DIR',
  'AWS_EXECUTION_ENV',
  'AWS_DEFAULT_REGION',
  'AWS_REGION',
  'AWS_LAMBDA_LOG_GROUP_NAME',
  'AWS_LAMBDA_LOG_STREAM_NAME',
  'AWS_LAMBDA_FUNCTION_NAME',
  'AWS_LAMBDA_FUNCTION_MEMORY_SIZE',
  'AWS_LAMBDA_FUNCTION_VERSION',
  'AWS_ACCESS_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_KEY',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'TZ',
];
const AWS_RESERVED_VARS_INFO_URL =
  'https://docs.aws.amazon.com/lambda/latest/dg/current-supported-versions.html#lambda-environment-variables';

/* TODO
  - Make sure the shape of dataForFunc mimics shape of data passed in first param in cloud functions
    - Determine how to pass isLoggedIn values
  - Update output
    - res.json() -- use same same output as hs logs
    - localFunctionTestServer endpoints list -- use same output as hs functions list
  - Move to separate package?
*/

const loadAndValidateOptions = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
};

const installDeps = folderPath => {
  const npmCmd = os.platform().startsWith('win') ? 'npm.cmd' : 'npm';
  const packageJsonPath = `${folderPath}/package.json`;
  const packageJsonExists = fs.existsSync(packageJsonPath);

  if (!packageJsonExists) {
    logger.debug(`No package.json found: using default dependencies.`);
    fs.writeFileSync(
      `${folderPath}/package.json`,
      JSON.stringify(defaultFunctionPackageJson)
    );
  }

  const packageJson = require(packageJsonPath);
  const numDeps = Object.keys(packageJson.dependencies).length;

  if (numDeps > MAX_DEPS) {
    logger.warn(
      `This function exceeds the maximum number of ${MAX_DEPS} dependencies. See https://developers.hubspot.com/docs/cms/features/serverless-functions#know-your-limits for more info.`
    );
  }

  logger.debug(`Installing dependencies from ${folderPath}/package.json`);

  return new Promise((resolve, reject) => {
    try {
      const npmInstallProcess = spawn(npmCmd, ['i'], {
        env: process.env,
        cwd: folderPath,
      });

      npmInstallProcess.on('exit', data => {
        resolve(data);
      });
    } catch (e) {
      reject(e);
    }
  });
};

const cleanupArtifacts = folderPath => {
  if (fs.existsSync(folderPath)) {
    logger.debug(`Cleaning up artifacts: ${folderPath}.`);
    fs.rmdirSync(folderPath, { recursive: true });
  }
};

const loadDotEnvFile = folderPath => {
  const dotEnvPathMaybe = `${folderPath}/.env`;

  if (fs.existsSync(dotEnvPathMaybe)) {
    const loadedConfig = require('dotenv').config({ path: dotEnvPathMaybe });
    logger.debug(`Loaded .env config from ${dotEnvPathMaybe}.`);
    return loadedConfig;
  }

  return {};
};

const getSecrets = async (functionPath, secrets) => {
  const config = await loadDotEnvFile(functionPath);
  let secretsDict = {};

  if (config.error) {
    throw config.error;
  }

  secrets.forEach(secret => {
    if (Object.prototype.hasOwnProperty.call(process.env, secret)) {
      secretsDict[secret] = process.env[secret];
    }
  });

  return secretsDict;
};

const loadEnvironmentVariables = (
  globalEnvironment = {},
  localEnvironment = {}
) => {
  Object.keys(globalEnvironment).forEach(globalEnvironmentVariable => {
    if (AWS_RESERVED_VARS.indexOf(globalEnvironmentVariable) !== -1) {
      logger.warn(
        `The variable ${globalEnvironmentVariable} is a reserved AWS variable and should not be used. See ${AWS_RESERVED_VARS_INFO_URL} for more info.`
      );
    }

    logger.debug(
      `Setting environment variable(global) ${globalEnvironmentVariable} to ${localEnvironment[globalEnvironmentVariable]}.`
    );
    process.env[globalEnvironmentVariable] =
      globalEnvironment[globalEnvironmentVariable];
  });

  Object.keys(localEnvironment).forEach(localEnvironmentVariable => {
    if (AWS_RESERVED_VARS.indexOf(localEnvironmentVariable) !== -1) {
      logger.warn(
        `The variable ${localEnvironmentVariable} is a reserved AWS variable and should not be used. See ${AWS_RESERVED_VARS_INFO_URL} for more info.`
      );
    }

    logger.debug(
      `Setting environment variable(local) ${localEnvironmentVariable} to ${localEnvironment[localEnvironmentVariable]}.`
    );
    process.env[localEnvironmentVariable] =
      localEnvironment[localEnvironmentVariable];
  });
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
  secrets
) => {
  app[method.toLowerCase()](`/${route}`, async (req, res) => {
    const startTime = performance.now();
    const functionFilePath = path.resolve(`${functionPath}/${file}`);
    if (!fs.existsSync(functionFilePath)) {
      logger.error(`Could not find file ${functionPath}/${file}.`);
      return;
    }
    const { main } = require(functionFilePath);

    if (!main) {
      logger.error(`Could not find "main" export in ${functionPath}/${file}.`);
    }

    loadEnvironmentVariables(globalEnvironment, localEnvironment);

    try {
      const dataForFunc = {
        secrets: await getSecrets(functionPath, secrets),
        params: req.query,
        limits: {
          timeRemaining: 600000,
          executionsRemaining: 60,
        },
        body: req.body,
        headers: req.headers,
        accountId,
      };

      await main(dataForFunc, sendResponseValue => {
        const endTime = performance.now();
        const runTime = endTime - startTime;
        const roundedRuntime = Math.round(runTime);

        if (runTime > MAX_RUNTIME) {
          logger.warn(
            `Function runtime ${roundedRuntime}ms exceeded maximum runtime of ${MAX_RUNTIME}. See https://developers.hubspot.com/docs/cms/features/serverless-functions#know-your-limits for more info.`
          );
        } else {
          logger.info(`Function executed in ${roundedRuntime}ms.`);
        }

        res.json(sendResponseValue);
      });
    } catch (e) {
      res.json(e);
    }
  });
};

const getValidatedFunctionData = functionPath => {
  if (!fs.existsSync(functionPath)) {
    logger.error(`The path ${functionPath} does not exist.`);
    return;
  } else {
    const stats = fs.lstatSync(functionPath);
    if (!stats.isDirectory()) {
      logger.error(`${functionPath} is not a valid functions directory.`);
      return;
    }
  }

  const { endpoints, environment, secrets } = JSON.parse(
    fs.readFileSync(`${functionPath}/serverless.json`, {
      encoding: 'utf-8',
    })
  );
  const routes = Object.keys(endpoints);

  if (!routes.length) {
    logger.error(`No endpoints found in ${functionPath}/serverless.json.`);
    return;
  }

  if (secrets.length > MAX_SECRETS) {
    logger.warn(
      `This function currently exceeds the limit of ${MAX_SECRETS} secrets. See https://developers.hubspot.com/docs/cms/features/serverless-functions#know-your-limits for more info.`
    );
  }

  return {
    srcPath: functionPath,
    endpoints,
    environment,
    routes,
    secrets,
  };
};

const createTemporaryFunction = async functionData => {
  const tmpDir = tmp.dirSync();

  logger.debug(`Created temporary function test folder: ${tmpDir.name}`);

  await fs.copy(functionData.srcPath, tmpDir.name, {
    overwrite: false,
    errorOnExist: true,
  });

  await installDeps(tmpDir.name);

  return {
    ...functionData,
    tmpDir,
  };
};

const runTestServer = async (port, accountId, functionPath) => {
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
          secrets
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
        secrets
      );
    }
  });

  const localFunctionTestServer = app.listen(port, () => {
    console.log(`Local test server running at http://localhost:${port}`);
    console.log(
      'Endpoints:\n',
      util.inspect(endpoints, {
        colors: true,
        compact: true,
        depth: 'Infinity',
      })
    );
  });

  process.on('SIGINT', () => {
    localFunctionTestServer.close();
    logger.info('Local function test server closed.');
    cleanupArtifacts(tmpDir.name);
    process.exit();
  });
};

exports.command = 'test <path>';
exports.describe = false;

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { path: functionPath, port } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('functions-test', { functionPath }, accountId);

  const splitFunctionPath = functionPath.split('.');

  if (
    !splitFunctionPath.length ||
    splitFunctionPath[splitFunctionPath.length - 1] !== 'functions'
  ) {
    logger.error(`Specified path ${functionPath} is not a .functions folder.`);
    return;
  }

  logger.debug(
    `Starting test server for .functions folder with path: ${functionPath}`
  );

  try {
    await runTestServer(port, accountId, functionPath);
  } catch (e) {
    logErrorInstance(e, {
      port,
      accountId,
      functionPath,
    });
  }
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: 'Path to local .functions folder',
    type: 'string',
  });
  yargs.option('port', {
    describe: 'port to run the test server on',
    type: 'string',
    default: 5432,
  });
  yargs.example([
    [
      '$0 functions test ./tmp/myFunctionFolder.functions',
      'Run a local function test server.',
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};

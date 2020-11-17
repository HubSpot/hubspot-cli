const express = require('express');
const fs = require('fs');
const path = require('path');
const util = require('util');
const { spawn } = require('child_process');
const os = require('os');
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
const { handleExit } = require('@hubspot/cms-lib/lib/process');
const { validateAccount } = require('../../lib/validation');

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

/*
  ==== TODO ====
  - Handle functions with no package.json
  - Handle functions with multiple methods
*/

const installDeps = folderPath => {
  const npmCmd = os.platform().startsWith('win') ? 'npm.cmd' : 'npm';

  return new Promise((resolve, reject) => {
    try {
      const npmInstallProcess = spawn(npmCmd, ['i'], {
        env: process.env,
        cwd: folderPath,
        stdio: 'inherit',
      });

      npmInstallProcess.on('exit', resolve);
    } catch (e) {
      reject(e);
    }
  });
};

const cleanupArtifacts = folderPath => {
  fs.rmdirSync(`${folderPath}/node_modules`, { recursive: true });
  fs.unlinkSync(`${folderPath}/package-lock.json`);
};

const loadEnvVars = folderPath => {
  const dotEnvPathMaybe = `${folderPath}/.env`;

  if (fs.existsSync(dotEnvPathMaybe)) {
    return require('dotenv').config({ path: dotEnvPathMaybe });
  }

  return {};
};

const runTestServer = async (port, accountId, functionPath) => {
  const { endpoints, environment } = JSON.parse(
    fs.readFileSync(`${functionPath}/serverless.json`, {
      encoding: 'utf-8',
    })
  );
  const routes = Object.keys(endpoints);

  if (!routes.length) {
    logger.error(`No endpoints found in ${functionPath}/serverless.json.`);
    return;
  }

  await installDeps(functionPath);
  handleExit(() => {
    cleanupArtifacts(functionPath);
  });

  const app = express();
  routes.forEach(route => {
    const { method, file } = endpoints[route];

    // TODO - Handle multiple methods here(GET & POST)
    app[method.toLowerCase()](route, async (req, res) => {
      const functionFilePath = path.resolve(`${functionPath}/${file}`);
      if (!fs.existsSync(functionFilePath)) {
        logger.error(`Could not find file ${functionPath}/${file}.`);
        return;
      }
      const { main } = require(functionFilePath);

      if (!main) {
        logger.error(
          `Could not find "main" export in ${functionPath}/${file}.`
        );
      }

      const config = await loadEnvVars(functionPath);

      if (config.error) {
        throw config.error;
      }

      const { parsed } = config;

      try {
        const dataForFunc = {
          accountId,
          ...req,
          ...parsed,
          ...environment,
        };

        await main(dataForFunc, sendResponseValue => {
          res.json(sendResponseValue);
        });
      } catch (e) {
        res.json(e);
      }
    });
  });

  app.listen(port, () => {
    console.log(
      `Local function test server running at http://localhost:${port}`
    );
    console.log(
      'Endpoints: ',
      util.inspect(endpoints, {
        colors: true,
        compact: true,
        depth: 'Infinity',
      })
    );
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
    console.log('============ ERROR ===============');
    console.log(e);
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

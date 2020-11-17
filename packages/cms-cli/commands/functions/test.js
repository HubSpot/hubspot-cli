// const ora = require('ora');
const express = require('express');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
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
const { validateAccount } = require('../../lib/validation');

// const makeSpinner = (functionPath, accountIdentifier) => {
//   return ora(
//     `Test server running for '${functionPath}' on account '${accountIdentifier}'.\n`
//   );
// };

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

  return new Promise((resolve, reject) => {
    try {
      // install folder
      const npmInstallProcess = cp.spawn(npmCmd, ['i'], {
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

// const cleanupDeps = folderPath => {
//   // Delete node_modules and package-lock.json from folderPath
// };

const loadEnvVars = folderPath => {
  const dotEnvPathMaybe = `${folderPath}/.env`;

  if (fs.existsSync(dotEnvPathMaybe)) {
    return require('dotenv').config({ path: dotEnvPathMaybe });
  }

  return {};
};

const runTestServer = async (accountId, functionPath) => {
  /*
    Load .env from path
    Load serverless.json
      - Mapping routes:files
      - Environment?
      - Secrets?
    Load package.json
      - Inject deps into functions
  */
  const { endpoints /*environment, secrets*/ } = JSON.parse(
    fs.readFileSync(`${functionPath}/serverless.json`, {
      encoding: 'utf-8',
    })
  );
  const routes = Object.keys(endpoints);

  console.log('serverlessJson endpoints: ', endpoints);

  if (!routes.length) {
    logger.error('No endpoints found in serverless.json.');
  }

  await installDeps(functionPath);

  const app = express();
  routes.forEach(route => {
    const { method, file } = endpoints[route];

    // TODO - Handle multiple methods here
    app[method.toLowerCase()](route, async (req, res) => {
      const { main } = require(path.resolve(`${functionPath}/${file}`));
      const config = await loadEnvVars(functionPath);

      if (config.error) {
        throw config.error;
      }

      const { parsed } = config;

      console.log('main: ', main);
      try {
        const dataForFunc = {
          accountId,
          ...req,
          ...parsed,
        };

        console.log('dataForFunc: ', dataForFunc);
        await main(dataForFunc, sendResponseValue => {
          console.log('sendResponseValue: ', sendResponseValue);
          res.json(sendResponseValue);
        });
      } catch (e) {
        res.json(e);
      }
    });
  });

  app.listen(5432, () => {
    console.log(`Example app listening at http://localhost:${5432}`);
  });
};

exports.command = 'test <path>';
exports.describe = false;
// Uncomment to unhide 'builds a new dependency bundle for the specified .functions folder';

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { path: functionPath } = options;
  const accountId = getAccountId(options);
  // const spinner = makeSpinner(functionPath, accountId);

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

  // spinner.start();
  try {
    await runTestServer(accountId, functionPath);
    // spinner.stop();
  } catch (e) {
    // spinner.stop();
    console.log('============ ERROR ===============');
    console.log(e);
  }
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: 'Path to local .functions folder',
    type: 'string',
  });
  yargs.example([
    [
      '$0 functions test ./tmp/myFunctionFolder.functions',
      "Run a local serverless function test server (I know it's quite ironic)",
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};

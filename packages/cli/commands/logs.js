const Spinnies = require('spinnies');
const {
  addAccountOptions,
  addConfigOptions,
  setLogLevel,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../lib/commonOpts');
const { trackCommandUsage } = require('../lib/usageTracking');
const { logDebugInfo } = require('../lib/debugInfo');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const { logger } = require('@hubspot/cli-lib/logger');
const { outputLogs } = require('@hubspot/cli-lib/lib/logs');
const {
  getFunctionLogs,
  getLatestFunctionLog,
} = require('@hubspot/cli-lib/api/results');
const { validateAccount } = require('../lib/validation');
const { tailLogs } = require('../lib/serverlessLogs');
const { EXIT_CODES } = require('../lib/exitCodes');

const loadAndValidateOptions = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(EXIT_CODES.ERROR);
  }
};

const handleLogsError = (e, accountId, functionPath) => {
  if (e.statusCode === 404) {
    logger.error(
      `No logs were found for the function path '${functionPath}' in account ${accountId}.`
    );
  }
};

const endpointLog = async (accountId, options) => {
  const { latest, follow, compact, endpoint: functionPath } = options;

  logger.debug(
    `Getting ${
      latest ? 'latest ' : ''
    }logs for function with path: ${functionPath}`
  );

  let logsResp;

  if (follow) {
    const spinnies = new Spinnies();

    spinnies.add('tailLogs', {
      text: `Waiting for log entries for '${functionPath}' on account '${accountId}'.\n`,
    });
    const tailCall = after =>
      getFunctionLogs(accountId, functionPath, { after });
    const fetchLatest = () => {
      try {
        getLatestFunctionLog(accountId, functionPath);
      } catch (e) {
        handleLogsError(e, accountId, functionPath);
      }
    };

    await tailLogs({
      accountId,
      compact,
      spinnies,
      tailCall,
      fetchLatest,
    });
  } else if (latest) {
    try {
      logsResp = await getLatestFunctionLog(accountId, functionPath);
    } catch (e) {
      handleLogsError(e, accountId, functionPath);
    }
  } else {
    try {
      logsResp = await getFunctionLogs(accountId, functionPath, options);
    } catch (e) {
      handleLogsError(e, accountId, functionPath);
    }
  }

  if (logsResp) {
    return outputLogs(logsResp, options);
  }
};

exports.command = 'logs [endpoint]';
exports.describe = 'get logs for a function';

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { latest } = options;

  const accountId = getAccountId(options);

  trackCommandUsage('logs', { latest }, accountId);

  endpointLog(accountId, options);
};

exports.builder = yargs => {
  yargs.positional('endpoint', {
    describe: 'Serverless function endpoint',
    type: 'string',
  });
  yargs
    .options({
      latest: {
        alias: 'l',
        describe: 'retrieve most recent log only',
        type: 'boolean',
      },
      compact: {
        describe: 'output compact logs',
        type: 'boolean',
      },
      follow: {
        alias: ['t', 'tail', 'f'],
        describe: 'follow logs',
        type: 'boolean',
      },
      limit: {
        alias: ['limit', 'n', 'max-count'],
        describe: 'limit the number of logs to output',
        type: 'number',
      },
    })
    .conflicts('follow', 'limit')
    .conflicts('functionName', 'endpoint');

  yargs.example([
    [
      '$0 logs my-endpoint',
      'Get 5 most recent logs for function residing at /_hcms/api/my-endpoint',
    ],
    [
      '$0 logs my-endpoint --limit=10',
      'Get 10 most recent logs for function residing at /_hcms/api/my-endpoint',
    ],
    [
      '$0 logs my-endpoint --follow',
      'Poll for and output logs for function residing at /_hcms/api/my-endpoint immediately upon new execution',
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};

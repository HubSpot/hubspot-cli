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
const {
  logServerlessFunctionApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { outputLogs } = require('@hubspot/cli-lib/lib/logs');
const { getFunctionByPath } = require('@hubspot/cli-lib/api/functions');
const {
  getFunctionLogs,
  getLatestFunctionLog,
} = require('@hubspot/cli-lib/api/results');
const { validateAccount } = require('../lib/validation');
const { tailLogs } = require('../lib/serverlessLogs');

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

exports.command = 'logs [endpoint]';
exports.describe = 'get logs for a function';

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { latest, follow, compact, endpoint: functionPath } = options;
  let logsResp;
  const accountId = getAccountId(options);

  trackCommandUsage('logs', { latest }, accountId);

  logger.debug(
    `Getting ${
      latest ? 'latest ' : ''
    }logs for function with path: ${functionPath}`
  );

  const functionResp = await getFunctionByPath(accountId, functionPath).catch(
    async e => {
      await logServerlessFunctionApiErrorInstance(
        accountId,
        e,
        new ApiErrorContext({ accountId, functionPath })
      );
      process.exit();
    }
  );

  logger.debug(`Retrieving logs for functionId: ${functionResp.id}`);

  if (follow) {
    await tailLogs({
      functionId: functionResp.id,
      functionPath,
      accountId,
      accountName: options.portal,
      compact,
    });
  } else if (latest) {
    logsResp = await getLatestFunctionLog(accountId, functionResp.id);
  } else {
    logsResp = await getFunctionLogs(accountId, functionResp.id, options);
  }

  if (logsResp) {
    return outputLogs(logsResp, options);
  }
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
    .conflicts('follow', 'limit');

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

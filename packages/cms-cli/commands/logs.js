const readline = require('readline');
const ora = require('ora');
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
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const {
  logServerlessFunctionApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cms-lib/errorHandlers');
const { outputLogs } = require('@hubspot/cms-lib/lib/logs');
const { getFunctionByPath } = require('@hubspot/cms-lib/api/functions');
const {
  getFunctionLogs,
  getLatestFunctionLog,
} = require('@hubspot/cms-lib/api/results');
const { base64EncodeString } = require('@hubspot/cms-lib/lib/encoding');
const { validateAccount } = require('../lib/validation');

const TAIL_DELAY = 5000;

const makeSpinner = (functionPath, accountId) => {
  return ora(
    `Waiting for log entries for '${functionPath}' on account '${accountId}'.\n`
  );
};

const makeTailCall = (accountId, functionId) => {
  return async after => {
    const latestLog = await getFunctionLogs(accountId, functionId, { after });
    return latestLog;
  };
};

const handleKeypressToExit = exit => {
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.on('keypress', (str, key) => {
    if (key && ((key.ctrl && key.name == 'c') || key.name === 'escape')) {
      exit();
    }
  });
};

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

const tailLogs = async ({
  functionId,
  functionPath,
  accountId,
  accountName,
  compact,
}) => {
  const tailCall = makeTailCall(accountId, functionId);
  const spinner = makeSpinner(functionPath, accountName || accountId);
  let initialAfter;

  spinner.start();

  try {
    const latestLog = await getLatestFunctionLog(accountId, functionId);
    initialAfter = base64EncodeString(latestLog.id);
  } catch (e) {
    // A 404 means no latest log exists(never executed)
    if (e.statusCode !== 404) {
      await logServerlessFunctionApiErrorInstance(
        accountId,
        e,
        new ApiErrorContext({ accountId, functionPath })
      );
    }
  }

  const tail = async after => {
    const latestLog = await tailCall(after);

    if (latestLog.results.length) {
      spinner.clear();
      outputLogs(latestLog, {
        compact,
      });
    }

    setTimeout(() => {
      tail(latestLog.paging.next.after);
    }, TAIL_DELAY);
  };

  handleKeypressToExit(() => {
    spinner.stop();
    process.exit();
  });
  tail(initialAfter);
};

exports.command = 'logs <path>';
exports.describe = 'get logs for a function';

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { latest, follow, compact, path: functionPath } = options;
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
  yargs.positional('path', {
    describe: 'Path to serverless function',
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

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};

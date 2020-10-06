const readline = require('readline');
const ora = require('ora');
const {
  addPortalOptions,
  addConfigOptions,
  setLogLevel,
  getPortalId,
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
const { getFunctionByPath } = require('@hubspot/cms-lib/api/function');
const {
  getFunctionLogs,
  getLatestFunctionLog,
} = require('@hubspot/cms-lib/api/results');
const { base64EncodeString } = require('@hubspot/cms-lib/lib/encoding');
const { validatePortal } = require('../lib/validation');

const TAIL_DELAY = 5000;

const makeSpinner = (functionPath, portalIdentifier) => {
  return ora(
    `Waiting for log entries for '${functionPath}' on portal '${portalIdentifier}'.\n`
  );
};

const makeTailCall = (portalId, functionId) => {
  return async after => {
    const latestLog = await getFunctionLogs(portalId, functionId, { after });
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

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }
};

const tailLogs = async ({
  functionId,
  functionPath,
  portalId,
  portalName,
  compact,
}) => {
  const tailCall = makeTailCall(portalId, functionId);
  const spinner = makeSpinner(functionPath, portalName || portalId);
  let initialAfter;

  spinner.start();

  try {
    const latestLog = await getLatestFunctionLog(portalId, functionId);
    initialAfter = base64EncodeString(latestLog.id);
  } catch (e) {
    // A 404 means no latest log exists(never executed)
    if (e.statusCode !== 404) {
      await logServerlessFunctionApiErrorInstance(
        portalId,
        e,
        new ApiErrorContext({ portalId, functionPath })
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
  const portalId = getPortalId(options);

  trackCommandUsage('logs', { latest }, portalId);

  logger.debug(
    `Getting ${
      latest ? 'latest ' : ''
    }logs for function with path: ${functionPath}`
  );

  const functionResp = await getFunctionByPath(portalId, functionPath).catch(
    async e => {
      await logServerlessFunctionApiErrorInstance(
        portalId,
        e,
        new ApiErrorContext({ portalId, functionPath })
      );
      process.exit();
    }
  );

  logger.debug(`Retrieving logs for functionId: ${functionResp.id}`);

  if (follow) {
    await tailLogs({
      functionId: functionResp.id,
      functionPath,
      portalId,
      Name: options.portal,
      compact,
    });
  } else if (latest) {
    logsResp = await getLatestFunctionLog(portalId, functionResp.id);
  } else {
    logsResp = await getFunctionLogs(portalId, functionResp.id, options);
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
  yargs.options({
    latest: {
      alias: 'l',
      describe: 'retrieve most recent log only',
      type: 'boolean',
    },
    compact: {
      describe: 'output compact logs',
      type: 'boolean',
    },
    tail: {
      alias: ['t', 'follow', 'f'],
      describe: 'tail logs',
      type: 'boolean',
    },
    limit: {
      alias: ['limit', 'n', 'max-count'],
      describe: 'limit the number of logs to output',
      type: 'number',
    },
    after: {
      alias: ['after', 'since'],
      describe: 'show logs more recent than a specific date (format?)',
      type: 'string',
    },
    before: {
      alias: ['before', 'until'],
      describe: 'show logs older than a specific date (format?)',
      type: 'string',
    },
  });

  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};

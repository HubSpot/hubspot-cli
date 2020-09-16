const { version } = require('../package.json');
const readline = require('readline');
const ora = require('ora');
const {
  addLoggerOptions,
  addPortalOptions,
  addConfigOptions,
  setLogLevel,
  getPortalId,
} = require('../lib/commonOpts');
const {
  trackCommandUsage,
  addHelpUsageTracking,
} = require('../lib/usageTracking');
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
const { validatePortal } = require('../lib/validation');
const { getFunctionByPath } = require('@hubspot/cms-lib/api/function');
const {
  getFunctionLogs,
  getLatestFunctionLog,
} = require('@hubspot/cms-lib/api/results');
const { base64EncodeString } = require('@hubspot/cms-lib/lib/encoding');
const { getScopeDataForFunctions } = require('@hubspot/cms-lib/lib/scopes');

const COMMAND_NAME = 'logs';
const DESCRIPTION = 'get logs for a function';
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

const loadAndValidateOptions = async command => {
  setLogLevel(command);
  logDebugInfo(command);
  const { config: configPath } = command;
  loadConfig(configPath);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(command)))) {
    process.exit(1);
  }
};

const logError = async (error, portalId, functionPath) => {
  return logServerlessFunctionApiErrorInstance(
    error,
    await getScopeDataForFunctions(portalId),
    new ApiErrorContext({ portalId, functionPath })
  );
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
      await logError(e, portalId, functionPath);
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

const action = async ({ functionPath }, command) => {
  loadAndValidateOptions(command);

  const { latest, file, follow, compact } = command;
  let logsResp;
  const portalId = getPortalId(command);

  trackCommandUsage(COMMAND_NAME, { latest, file }, command);

  logger.debug(
    `Getting ${
      latest ? 'latest ' : ''
    }logs for function with path: ${functionPath}`
  );

  const functionResp = await getFunctionByPath(portalId, functionPath).catch(
    async e => {
      await logError(e, portalId, functionPath);
      process.exit();
    }
  );

  logger.debug(`Retrieving logs for functionId: ${functionResp.id}`);

  if (follow) {
    await tailLogs({
      functionId: functionResp.id,
      functionPath,
      portalId,
      Name: command.portal,
      compact,
    });
  } else if (latest) {
    logsResp = await getLatestFunctionLog(portalId, functionResp.id);
  } else {
    logsResp = await getFunctionLogs(portalId, functionResp.id);
  }

  if (logsResp) {
    return outputLogs(logsResp, {
      compact,
    });
  }
};

// Yargs Configuration
const command = `${COMMAND_NAME} <path>`;
const describe = DESCRIPTION;
const builder = yargs => {
  yargs.positional('path', {
    describe: 'Path to serverless function',
    type: 'string',
  });
  yargs.option('latest', {
    alias: 'l',
    describe: 'retrieve most recent log only',
    type: 'boolean',
  });
  yargs.option('compact', {
    alias: 'c',
    describe: 'output compact logs',
    type: 'boolean',
  });
  yargs.option('tail', {
    alias: ['t', 'follow', 'f'],
    describe: 'tail logs',
    type: 'boolean',
  });

  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);

  return yargs;
};
const handler = async argv => action({ functionPath: argv.path }, argv);

// Commander Configuration
const configureCommanderLogsCommand = commander => {
  commander
    .version(version)
    .description(DESCRIPTION)
    .arguments('<function_path>')
    .option('--latest', 'retrieve most recent log only')
    .option('--compact', 'output compact logs')
    .option('-f, --follow', 'tail logs')
    .action(async (functionPath, command = {}) =>
      action({ functionPath }, command)
    );

  addConfigOptions(commander);
  addPortalOptions(commander);
  addLoggerOptions(commander);
  addHelpUsageTracking(commander, COMMAND_NAME);
};

module.exports = {
  // Yargs
  command,
  describe,
  builder,
  handler,
  // Commander
  configureCommanderLogsCommand,
};

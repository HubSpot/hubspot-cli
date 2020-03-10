const { version } = require('../package.json');
const readline = require('readline');
const ora = require('ora');
const {
  addLoggerOptions,
  addPortalOptions,
  setLogLevel,
  getPortalId,
} = require('../lib/commonOpts');
const {
  trackCommandUsage,
  addHelpUsageTracking,
} = require('../lib/usageTracking');
const { logDebugInfo } = require('../lib/debugInfo');
const { loadConfig, checkAndWarnGitInclusion } = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { logApiErrorInstance } = require('@hubspot/cms-lib/errorHandlers');
const { outputLogs } = require('@hubspot/cms-lib/lib/logs');
const { getFunctionByPath } = require('@hubspot/cms-lib/api/function');
const {
  getFunctionLogs,
  getLatestFunctionLog,
} = require('@hubspot/cms-lib/api/results');
const { base64EncodeString } = require('@hubspot/cms-lib/lib/encoding');

const COMMAND_NAME = 'logs';
const TAIL_DELAY = 5000;

const makeSpinner = (functionPath, portalIdentifier) => {
  return ora(
    `Tailing logs for '${functionPath}' on portal '${portalIdentifier}'.\n`
  );
};

const makeTailCall = (portalId, functionId) => {
  return async after => {
    const latestLog = await getFunctionLogs(portalId, functionId, { after });
    return latestLog;
  };
};

const allowExitOnKeypress = allowExit => {
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.on('keypress', (str, key) => {
    if (key && ((key.ctrl && key.name == 'c') || key.name === 'escape')) {
      allowExit();
    }
  });
};

const tailLogs = async (portalId, functionId, functionPath, portalName) => {
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
      logApiErrorInstance(e, {
        functionPath,
        portalId,
      });
    }
  }

  const tail = async after => {
    const latestLog = await tailCall(after);

    if (latestLog.results.length) {
      spinner.clear();
      outputLogs(latestLog);
    }

    setTimeout(() => {
      tail(latestLog.paging.next.after);
    }, TAIL_DELAY);
  };

  allowExitOnKeypress(() => {
    spinner.stop();
    process.exit();
  });
  tail(initialAfter);
};

const getLogs = program => {
  program
    .version(version)
    .description(`get logs for a function`)
    .arguments('<function_path>')
    .option('--latest', 'retrieve most recent log only')
    .option('-f, --follow', 'tail logs')
    .action(async (functionPath, options) => {
      const { config: configPath } = options;
      const portalId = getPortalId(program);
      const { latest, file, follow } = options;
      let logsResp;

      setLogLevel(options);
      logDebugInfo(options);
      loadConfig(configPath);
      checkAndWarnGitInclusion();
      trackCommandUsage(
        COMMAND_NAME,
        {
          latest,
          file,
        },
        portalId
      );

      logger.debug(
        `Getting ${
          latest ? 'latest ' : ''
        }logs for function with path: ${functionPath}`
      );

      const functionResp = await getFunctionByPath(
        portalId,
        functionPath
      ).catch(e => {
        logApiErrorInstance(e, {
          functionPath,
          portalId,
        });
        process.exit(1);
      });

      logger.debug(`Retrieving logs for functionId: ${functionResp.id}`);

      if (follow) {
        tailLogs(portalId, functionResp.id, functionPath, options.portal);
      } else if (latest) {
        logsResp = await getLatestFunctionLog(portalId, functionResp.id);
      } else {
        logsResp = await getFunctionLogs(portalId, functionResp.id);
      }

      if (logsResp) {
        return outputLogs(logsResp);
      }
    });

  addPortalOptions(program);
  addLoggerOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
};

module.exports = {
  getLogs,
};

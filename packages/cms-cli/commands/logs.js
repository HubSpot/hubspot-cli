const { version } = require('../package.json');
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
const { toFile, outputLogs } = require('@hubspot/cms-lib/lib/logs');
const { getFunctionByPath } = require('@hubspot/cms-lib/api/function');
const {
  getFunctionLogs,
  getLatestFunctionLog,
} = require('@hubspot/cms-lib/api/results');
const { base64EncodeString } = require('@hubspot/cms-lib/lib/encoding');

const COMMAND_NAME = 'logs';
const TAIL_DELAY = 5000;

const makeTailCall = (portalId, functionId) => {
  return async after => {
    const latestLog = await getFunctionLogs(portalId, functionId, { after });

    if (latestLog.results.length) {
      outputLogs(latestLog);
    }

    return latestLog.paging.next.after;
  };
};

const tailLogs = async (functionPath, portalId, functionId) => {
  const tailCall = makeTailCall(portalId, functionId);
  let after;

  logger.log(
    `Tailing logs for '${functionPath}(${functionId})' on portal: ${portalId}.`
  );

  const latestLog = await getLatestFunctionLog(portalId, functionId);
  after = base64EncodeString(latestLog.id);

  return new Promise(() => {
    setInterval(async () => {
      // eslint-disable-next-line require-atomic-updates
      after = await tailCall(after);
    }, TAIL_DELAY);
  });
};

const getLogs = program => {
  program
    .version(version)
    .description(`get logs for a function`)
    .arguments('<function_path>')
    .option('-f, --file', 'output logs to file')
    .option('--latest', 'retrieve most recent log only')
    .option('--tail', 'tail logs')
    .action(async (functionPath, options) => {
      const { config: configPath } = options;
      const portalId = getPortalId(program);
      const { latest, file, tail } = options;
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

      if (tail) {
        logsResp = await tailLogs(functionPath, portalId, functionResp.id);
      } else if (latest) {
        logsResp = await getLatestFunctionLog(portalId, functionResp.id);
      } else {
        logsResp = await getFunctionLogs(portalId, functionResp.id);
      }

      if (file) {
        return toFile(logsResp);
      }

      return outputLogs(logsResp);
    });

  addPortalOptions(program);
  addLoggerOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
};

module.exports = {
  getLogs,
};

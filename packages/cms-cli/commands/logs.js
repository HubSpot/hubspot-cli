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

const COMMAND_NAME = 'logs';

function getLogs(program) {
  program
    .version(version)
    .description(`get logs for a function`)
    .arguments('<function_path>')
    .option('-f, --file', 'output logs to file')
    .option('--latest', 'retrieve most recent log only')
    .action(async (functionPath, options) => {
      const { config: configPath } = options;
      const portalId = getPortalId(program);
      const getLatestLogOnly = options && options.latest;
      const logToFile = options && options.file;
      let logsResp;

      setLogLevel(options);
      logDebugInfo(options);
      loadConfig(configPath, {
        allowEnvironmentVariableConfig: true,
      });
      checkAndWarnGitInclusion();
      trackCommandUsage(
        COMMAND_NAME,
        {
          latest: getLatestLogOnly,
          file: logToFile,
        },
        portalId
      );

      logger.debug(
        `Getting ${
          getLatestLogOnly ? 'latest ' : ''
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

      if (getLatestLogOnly) {
        logsResp = await getLatestFunctionLog(portalId, functionResp.id);
      } else {
        logsResp = await getFunctionLogs(portalId, functionResp.id);
      }

      if (logToFile) {
        return toFile(logsResp);
      }

      return outputLogs(logsResp);
    });

  addPortalOptions(program);
  addLoggerOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
}

module.exports = {
  getLogs,
};

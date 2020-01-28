const fs = require('fs');
const util = require('util');
const path = require('path');
const moment = require('moment');
const { logger } = require('../logger');

const FUNCTION_LOG_PATH = 'function.log';

const logHandler = {
  UNHANDLED_ERROR: log => {
    return `${formatTimestamp(log)} ${log.status}: ${log.error.type}: ${
      log.error.message
    } ${formatExecutionTime(log)}\n${formatStackTrace(log)}`;
  },
  HANDLED_ERROR: log => {
    return `${formatTimestamp(log)} ${log.status}: ${log.error.type}: ${
      log.error.message
    } ${formatExecutionTime(log)}\n${formatStackTrace(log)}`;
  },
  SUCCESS: log => {
    return `${formatTimestamp(log)} ${log.status}: ${formatPayload(
      log
    )} ${formatExecutionTime(log)}\n`;
  },
};

const formatStackTrace = log => {
  const stackTrace = (log.error.stackTrace && log.error.stackTrace[0]) || [];
  return stackTrace
    .map(trace => {
      return `  at ${trace}\n`;
    })
    .join('');
};

const formatTimestamp = log => {
  return `[${moment(log.createdAt).toISOString()}]`;
};

const formatPayload = log => {
  return util.inspect(log.payload, {
    compact: false,
  });
};

const formatExecutionTime = log => {
  return `(Execution Time: ${log.executionTime}ms)`;
};

const processLog = log => {
  try {
    return logHandler[log.status](log);
  } catch (e) {
    logger.error(`Unable to process log ${JSON.stringify(log)}`);
  }
};

const processLogs = logsResp => {
  if (logsResp.results && !logsResp.results.length) {
    return 'No logs found.';
  } else if (logsResp.results && logsResp.results.length) {
    return logsResp.results.map(processLog).join('');
  }
  return processLog(logsResp);
};

const toFile = logsResp => {
  logger.debug(`Writing function logs to ${FUNCTION_LOG_PATH}`);
  fs.writeFileSync(FUNCTION_LOG_PATH, processLogs(logsResp));
  logger.log(`Function logs saved to ${path.resolve(FUNCTION_LOG_PATH)}`);
};

const outputLogs = logsResp => {
  logger.log(processLogs(logsResp));
};

module.exports = {
  toFile,
  outputLogs,
};

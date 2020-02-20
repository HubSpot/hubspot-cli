const fs = require('fs');
const util = require('util');
const path = require('path');
const moment = require('moment');
const { logger } = require('../logger');

const FUNCTION_LOG_PATH = 'function.log';

const logHandler = {
  UNHANDLED_ERROR: log => {
    return `${formatLogHeader(log)}\n${log.error.type}: ${
      log.error.message
    }\n${formatStackTrace(log)}\n`;
  },
  HANDLED_ERROR: log => {
    return `${formatLogHeader(log)}\n${log.error.type}: ${
      log.error.message
    }\n${formatStackTrace(log)}\n`;
  },
  SUCCESS: log => {
    return `${formatLogHeader(log)}\n${formatPayload(log)}\n${formatLog(
      log
    )}\n`;
  },
};

const formatLogHeader = log => {
  return `${formatTimestamp(log)} ${log.status} ${formatExecutionTime(log)}`;
};

const formatLog = log => {
  return `${log.log}`;
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
    compact: true,
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

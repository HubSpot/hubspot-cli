const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { logger } = require('../logger');

const FUNCTION_LOG_PATH = 'function.log';

const logHandler = {
  HANDLED_ERROR: log => {
    return `${formatTimestamp(log)} ${log.status}: ${log.error.type}: ${
      log.error.message
    } ${formatExecutionTime(log)}\n${formatStacktrace(
      log.error.stackTrace[0]
    )}`;
  },
  SUCCESS: log => {
    return `${formatTimestamp(log)} ${log.status}: ${
      log.payload.message
    } ${formatExecutionTime(log)}\n`;
  },
};

const formatStacktrace = stackTrace => {
  return stackTrace
    .map(trace => {
      return `  at ${trace}\n`;
    })
    .join('');
};

const formatTimestamp = log => {
  return `[${moment(log.createdAt).format('MM/DD/YYYY hh:mm:ss a')}]`;
};

const formatExecutionTime = log => {
  return `(Execution Time: ${log.executionTime}ms)`;
};

const processLogs = logs => {
  return logs.map(log => logHandler[log.status](log)).join('');
};

const toFile = logs => {
  logger.debug(`Writing function logs to ${FUNCTION_LOG_PATH}`);
  fs.writeFileSync(FUNCTION_LOG_PATH, processLogs(logs));
  console.log(`Function logs saved to ${path.resolve(FUNCTION_LOG_PATH)}`);
};

const outputLogs = logs => {
  console.log(processLogs(logs));
};

module.exports = {
  toFile,
  outputLogs,
};

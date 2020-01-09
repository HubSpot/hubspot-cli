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

const processLog = log => {
  return logHandler[log.status](log);
};

const processLogs = logsResp => {
  if (logsResp.results && logsResp.results.length) {
    return logsResp.results.map(processLog).join('');
  }
  return processLog(logsResp);
};

const toFile = logsResp => {
  logger.debug(`Writing function logs to ${FUNCTION_LOG_PATH}`);
  fs.writeFileSync(FUNCTION_LOG_PATH, processLogs(logsResp));
  console.log(`Function logs saved to ${path.resolve(FUNCTION_LOG_PATH)}`);
};

const outputLogs = logsResp => {
  console.log(processLogs(logsResp));
};

module.exports = {
  toFile,
  outputLogs,
};

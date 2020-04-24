import util = require('util');
import moment = require('moment');
import { logger } from '../logger';

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
  if (!logsResp || (logsResp.results && !logsResp.results.length)) {
    return 'No logs found.';
  } else if (logsResp.results && logsResp.results.length) {
    return logsResp.results.map(processLog).join('');
  }
  return processLog(logsResp);
};

export const outputLogs = logsResp => {
  logger.log(processLogs(logsResp));
};

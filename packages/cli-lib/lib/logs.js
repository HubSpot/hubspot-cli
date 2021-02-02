const moment = require('moment');
const chalk = require('chalk');
const { logger, Styles } = require('../logger');

const SEPARATOR = ' - ';
const LOG_STATUS_COLORS = {
  SUCCESS: Styles.success,
  ERROR: Styles.error,
  UNHANDLED_ERROR: Styles.error,
  HANDLED_ERROR: Styles.error,
};

const errorHandler = (log, options) => {
  return `${formatLogHeader(log, options)}${formatError(log, options)}`;
};

const logHandler = {
  ERROR: errorHandler,
  UNHANDLED_ERROR: errorHandler,
  HANDLED_ERROR: errorHandler,
  SUCCESS: (log, options) => {
    return `${formatLogHeader(log, options)}${formatSuccess(log, options)}`;
  },
};

const formatSuccess = (log, options) => {
  if (!log.log || options.compact) {
    return '';
  }

  return `\n${log.log}`;
};

const formatError = (log, options) => {
  if (!log.error || options.compact) {
    return '';
  }

  return `${log.error.type}: ${log.error.message}\n${formatStackTrace(log)}`;
};

const formatLogHeader = (log, options) => {
  const color = LOG_STATUS_COLORS[log.status];
  const headerInsertion =
    options && options.insertions && options.insertions.header;

  return `${formatTimestamp(log)}${SEPARATOR}${color(log.status)}${
    headerInsertion ? `${SEPARATOR}${headerInsertion}` : ''
  }${SEPARATOR}${formatExecutionTime(log)}`;
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
  return `${chalk.whiteBright(moment(log.createdAt).toISOString())}`;
};

const formatExecutionTime = log => {
  return `${chalk.whiteBright('Execution Time:')} ${log.executionTime}ms`;
};

const processLog = (log, options) => {
  try {
    return logHandler[log.status](log, options);
  } catch (e) {
    logger.error(`Unable to process log ${JSON.stringify(log)}`);
  }
};

const processLogs = (logsResp, options) => {
  if (!logsResp || (logsResp.results && !logsResp.results.length)) {
    return 'No logs found.';
  } else if (logsResp.results && logsResp.results.length) {
    return logsResp.results
      .map(log => {
        return processLog(log, options);
      })
      .join('\n');
  }
  return processLog(logsResp, options);
};

const outputLogs = (logsResp, options) => {
  logger.log(processLogs(logsResp, options));
};

module.exports = {
  outputLogs,
};

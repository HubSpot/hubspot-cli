const moment = require('moment');
const chalk = require('chalk');
const { logger, Styles } = require('@hubspot/local-dev-lib/logger');

const { MAX_RUNTIME } = require('./constants');

const SEPARATOR = ' - ';
const LOG_STATUS_COLORS = {
  SUCCESS: Styles.success,
  ERROR: Styles.error,
  UNHANDLED_ERROR: Styles.error,
  HANDLED_ERROR: Styles.error,
};

function errorHandler(log, options) {
  return `${formatLogHeader(log, options)}${formatError(log, options)}`;
}

const logHandler = {
  ERROR: errorHandler,
  UNHANDLED_ERROR: errorHandler,
  HANDLED_ERROR: errorHandler,
  SUCCESS: (log, options) => {
    return `${formatLogHeader(log, options)}${formatSuccess(log, options)}`;
  },
};

function formatSuccess(log, options) {
  if (!log.log || options.compact) {
    return '';
  }

  return `\n${log.log}`;
}

function formatError(log, options) {
  if (!log.error || options.compact) {
    return '';
  }

  return `${log.error.type}: ${log.error.message}\n${formatStackTrace(log)}`;
}

function formatLogHeader(log, options) {
  const color = LOG_STATUS_COLORS[log.status];
  const headerInsertion =
    options && options.insertions && options.insertions.header;

  return `${formatTimestamp(log)}${SEPARATOR}${color(log.status)}${
    headerInsertion ? `${SEPARATOR}${headerInsertion}` : ''
  }${SEPARATOR}${formatExecutionTime(log)}`;
}

function formatStackTrace(log) {
  const stackTrace = (log.error.stackTrace && log.error.stackTrace[0]) || [];
  return stackTrace
    .map(trace => {
      return `  at ${trace}\n`;
    })
    .join('');
}

function formatTimestamp(log) {
  return `${chalk.whiteBright(moment(log.createdAt).toISOString())}`;
}

function formatExecutionTime(log) {
  return `${chalk.whiteBright('Execution Time:')} ${log.executionTime}ms`;
}

function processLog(log, options) {
  try {
    return logHandler[log.status](log, options);
  } catch (e) {
    logger.error(`Unable to process log ${JSON.stringify(log)}`);
  }
}

function processLogs(logsResp, options) {
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
}

const logFunctionExecution = ({
  status,
  payload,
  startTime,
  endTime,
  memoryUsed,
  options,
}) => {
  const runTime = endTime - startTime;
  const roundedRuntime = Math.round(runTime * 100);
  const roundedMemoryUsed = Math.round(memoryUsed);
  const executionData = {
    executionTime: runTime,
    duration: `${roundedRuntime} ms`,
    status,
    createdAt: startTime,
    memory: `${roundedMemoryUsed}/128 MB`,
    id: -1,
    payload,
  };

  logger.log(processLogs(executionData, options));

  if (runTime > MAX_RUNTIME) {
    logger.warn(
      `Function runtime ${roundedRuntime}ms exceeded maximum runtime of ${MAX_RUNTIME}. See https://developers.hubspot.com/docs/cms/features/serverless-functions#know-your-limits for more info.`
    );
  }
};

module.exports = {
  logFunctionExecution,
};

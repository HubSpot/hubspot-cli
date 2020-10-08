// const util = require('util');
// const moment = require('moment');
// const chalk = require('chalk');
const {
  logger,
  // Styles
} = require('../logger');

// const SEPARATOR = ' - ';
// const LOG_STATUS_COLORS = {
//   SUCCESS: Styles.success,
//   UNHANDLED_ERROR: Styles.error,
//   HANDLED_ERROR: Styles.error,
// };

// const formatError = log => {
//   return `/n${log.error.type}: ${log.error.message}\n${formatStackTrace(
//     log
//   )}\n`;
// };

// const logHandler = {
//   UNHANDLED_ERROR: (log, { compact }) => {
//     return `${formatLogHeader(log)}${compact ? '' : formatError(log)}`;
//   },
//   HANDLED_ERROR: (log, { compact }) => {
//     return `${formatLogHeader(log)}${compact ? '' : formatError(log)}`;
//   },
//   SUCCESS: (log, { compact }) => {
//     return `${formatLogHeader(log)}${compact ? '' : formatLogPayloadData(log)}`;
//   },
// };

// const formatLogPayloadData = log => {
//   return `\n${formatPayload(log)}\n${formatLog(log)}`;
// };

// const formatLogHeader = log => {
//   const color = LOG_STATUS_COLORS[log.status];

//   return `${formatTimestamp(log)}${SEPARATOR}${color(
//     log.status
//   )}${SEPARATOR}${formatExecutionTime(log)}`;
// };

// const formatLog = log => {
//   return `${log.log}`;
// };

// const formatStackTrace = log => {
//   const stackTrace = (log.error.stackTrace && log.error.stackTrace[0]) || [];
//   return stackTrace
//     .map(trace => {
//       return `  at ${trace}\n`;
//     })
//     .join('');
// };

// const formatTimestamp = log => {
//   return `${chalk.whiteBright(moment(log.createdAt).toISOString())}`;
// };

// const formatPayload = log => {
//   return util.inspect(log.payload, {
//     colors: true,
//     compact: true,
//     depth: 'Infinity',
//   });
// };

// const formatExecutionTime = log => {
//   return `${chalk.whiteBright('Execution Time:')} ${log.executionTime}ms`;
// };

// const processFunction = (func, options) => {
//   try {
//     return logHandler[func.status](func, options);
//   } catch (e) {
//     logger.error(`Unable to process log ${JSON.stringify(func)}`);
//   }
// };

const processOutput = (resp, options) => {
  console.log('Process output: ', resp, options);
  // if (!resp || (resp.results && !resp.results.length)) {
  //   return 'No functions found.';
  // } else if (resp.results && resp.results.length) {
  //   return resp.results
  //     .map(func => {
  //       return processFunction(func, options);
  //     })
  //     .join('\n');
  // }
  // return processFunction(resp, options);
};

const outputFunctions = (resp, options) => {
  logger.log(processOutput(resp, options));
};

module.exports = {
  outputFunctions,
};

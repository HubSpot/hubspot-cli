import moment from 'moment';
import chalk from 'chalk';
import { logger, Styles } from '@hubspot/local-dev-lib/logger';
import { i18n } from '../lang';
import {
  FunctionLog,
  GetFunctionLogsResponse,
} from '@hubspot/local-dev-lib/types/Functions';

const i18nKey = 'lib.ui.serverlessFunctionLogs';

const SEPARATOR = ' - ';
const LOG_STATUS_COLORS: { [key: string]: (status: string) => string } = {
  SUCCESS: Styles.success,
  ERROR: Styles.error,
  UNHANDLED_ERROR: Styles.error,
  HANDLED_ERROR: Styles.error,
};

type LogStatus = keyof typeof LOG_STATUS_COLORS;

type Options = {
  compact?: boolean;
  insertions?: {
    header?: string;
  };
};

function errorHandler(log: FunctionLog, options: Options): string {
  return `${formatLogHeader(log, options)}${formatError(log, options)}`;
}

const logHandler: {
  [key in LogStatus]: (log: FunctionLog, options: Options) => string;
} = {
  ERROR: errorHandler,
  UNHANDLED_ERROR: errorHandler,
  HANDLED_ERROR: errorHandler,
  SUCCESS: (log: FunctionLog, options: Options): string => {
    return `${formatLogHeader(log, options)}${formatSuccess(log, options)}`;
  },
};

function formatSuccess(log: FunctionLog, options: Options): string {
  if (!log.log || options.compact) {
    return '';
  }

  return `\n${log.log}`;
}

function formatError(log: FunctionLog, options: Options): string {
  if (!log.error || options.compact) {
    return '';
  }

  return `${log.error.type}: ${log.error.message}\n${formatStackTrace(log)}`;
}

function formatLogHeader(log: FunctionLog, options: Options): string {
  const color = LOG_STATUS_COLORS[log.status];
  const headerInsertion =
    options && options.insertions && options.insertions.header;

  return `${formatTimestamp(log)}${SEPARATOR}${color(log.status)}${
    headerInsertion ? `${SEPARATOR}${headerInsertion}` : ''
  }${SEPARATOR}${formatExecutionTime(log)}`;
}

function formatStackTrace(log: FunctionLog): string {
  const stackTrace = log.error?.stackTrace || [];
  return stackTrace
    .map(trace => {
      return `  at ${trace}\n`;
    })
    .join('');
}

function formatTimestamp(log: FunctionLog): string {
  return `${chalk.whiteBright(moment(log.createdAt).toISOString())}`;
}

function formatExecutionTime(log: FunctionLog): string {
  return `${chalk.whiteBright('Execution Time:')} ${log.executionTime}ms`;
}

function processLog(log: FunctionLog, options: Options): string | void {
  try {
    return logHandler[log.status](log, options);
  } catch (e) {
    logger.error(
      i18n(`${i18nKey}.unableToProcessLog`, {
        log: JSON.stringify(log),
      })
    );
  }
}

function isLogsResponse(
  logsResp: GetFunctionLogsResponse | FunctionLog
): logsResp is GetFunctionLogsResponse {
  return (
    logsResp &&
    'results' in logsResp &&
    Array.isArray(logsResp.results) &&
    logsResp.results !== undefined
  );
}

function processLogs(
  logsResp: GetFunctionLogsResponse | FunctionLog,
  options: Options
): string | void {
  const isLogsResp = isLogsResponse(logsResp);

  if (!logsResp || (isLogsResp && logsResp.results!.length === 0)) {
    return i18n(`${i18nKey}.noLogsFound`);
  } else if (isLogsResp) {
    return logsResp
      .results!.map(log => {
        return processLog(log, options);
      })
      .join('\n');
  }
  return processLog(logsResp, options);
}

export function outputLogs(
  logsResp: GetFunctionLogsResponse | FunctionLog,
  options: Options
): void {
  logger.log(processLogs(logsResp, options));
}

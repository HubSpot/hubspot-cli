import moment from 'moment';
import chalk from 'chalk';
import { logger, Styles } from '@hubspot/local-dev-lib/logger';
import { i18n } from '../lang';

const i18nKey = 'lib.ui.serverlessFunctionLogs';

const SEPARATOR = ' - ';
const LOG_STATUS_COLORS = {
  SUCCESS: Styles.success,
  ERROR: Styles.error,
  UNHANDLED_ERROR: Styles.error,
  HANDLED_ERROR: Styles.error,
};

type LogStatus = keyof typeof LOG_STATUS_COLORS;

type Log = {
  status: LogStatus;
  createdAt: string;
  executionTime: number;
  log?: string;
  error?: {
    type: string;
    message: string;
    stackTrace?: string[];
  };
};

type LogsResponse = {
  results?: Log[];
};

type Options = {
  compact?: boolean;
  insertions?: {
    header?: string;
  };
};

function errorHandler(log: Log, options: Options): string {
  return `${formatLogHeader(log, options)}${formatError(log, options)}`;
}

const logHandler: {
  [key in LogStatus]: (log: Log, options: Options) => string;
} = {
  ERROR: errorHandler,
  UNHANDLED_ERROR: errorHandler,
  HANDLED_ERROR: errorHandler,
  SUCCESS: (log: Log, options: Options): string => {
    return `${formatLogHeader(log, options)}${formatSuccess(log, options)}`;
  },
};

function formatSuccess(log: Log, options: Options): string {
  if (!log.log || options.compact) {
    return '';
  }

  return `\n${log.log}`;
}

function formatError(log: Log, options: Options): string {
  if (!log.error || options.compact) {
    return '';
  }

  return `${log.error.type}: ${log.error.message}\n${formatStackTrace(log)}`;
}

function formatLogHeader(log: Log, options: Options): string {
  const color = LOG_STATUS_COLORS[log.status];
  const headerInsertion =
    options && options.insertions && options.insertions.header;

  return `${formatTimestamp(log)}${SEPARATOR}${color(log.status)}${
    headerInsertion ? `${SEPARATOR}${headerInsertion}` : ''
  }${SEPARATOR}${formatExecutionTime(log)}`;
}

function formatStackTrace(log: Log): string {
  const stackTrace = log.error?.stackTrace || [];
  return stackTrace
    .map(trace => {
      return `  at ${trace}\n`;
    })
    .join('');
}

function formatTimestamp(log: Log): string {
  return `${chalk.whiteBright(moment(log.createdAt).toISOString())}`;
}

function formatExecutionTime(log: Log): string {
  return `${chalk.whiteBright('Execution Time:')} ${log.executionTime}ms`;
}

function processLog(log: Log, options: Options): string | void {
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
  logsResp: LogsResponse | Log
): logsResp is LogsResponse {
  return (
    logsResp &&
    'results' in logsResp &&
    Array.isArray(logsResp.results) &&
    logsResp.results !== undefined
  );
}

function processLogs(
  logsResp: LogsResponse | Log,
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
  return processLog(logsResp as Log, options);
}

export function outputLogs(
  logsResp: LogsResponse | Log,
  options: Options
): void {
  logger.log(processLogs(logsResp, options));
}

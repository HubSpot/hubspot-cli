import chalk from 'chalk';
import { LOG_LEVEL } from './types';

const Styles = {
  debug: chalk.reset.blue,
  log: chalk.reset,
  success: chalk.reset.green,
  info: chalk.reset.white,
  warn: chalk.reset.yellow,
  error: chalk.reset.red,
};

const stylize = (
  label: string,
  style: (label: string) => string,
  args: Array<any>
) => {
  const styledLabel = style(label);
  const [firstArg, ...rest] = args;
  if (typeof firstArg === 'string') {
    return [`${styledLabel} ${firstArg}`, ...rest];
  }
  return [styledLabel, ...args];
};

class Logger {
  error(...args: Array<any>) {
    console.error(...stylize('[ERROR]', Styles.error, args));
  }
  warn(...args: Array<any>) {
    console.warn(...stylize('[WARNING]', Styles.warn, args));
  }
  log(...args: Array<any>) {
    console.log(...args);
  }
  success(...args: Array<any>) {
    console.log(...stylize('[SUCCESS]', Styles.success, args));
  }
  info(...args: Array<any>) {
    console.info(...stylize('[INFO]', Styles.info, args));
  }
  debug(...args: Array<any>) {
    console.debug(...stylize('[DEBUG]', Styles.log, args));
  }
  group(...args: Array<any>) {
    console.group(...args);
  }
  groupEnd() {
    console.groupEnd();
  }
}

let currentLogger = new Logger();
let currentLogLevel = LOG_LEVEL.ERROR;

const setLogger = (logger: Logger) => {
  currentLogger = logger;
};

const setLogLevel = (level: LOG_LEVEL) => {
  switch (level) {
    case LOG_LEVEL.DEBUG:
      currentLogLevel =
        LOG_LEVEL.DEBUG | LOG_LEVEL.LOG | LOG_LEVEL.WARN | LOG_LEVEL.ERROR;
      break;
    case LOG_LEVEL.LOG:
      currentLogLevel = LOG_LEVEL.LOG | LOG_LEVEL.WARN | LOG_LEVEL.ERROR;
      break;
    case LOG_LEVEL.WARN:
      currentLogLevel = LOG_LEVEL.WARN | LOG_LEVEL.ERROR;
      break;
    case LOG_LEVEL.ERROR:
      currentLogLevel = LOG_LEVEL.ERROR;
      break;
    case LOG_LEVEL.NONE:
    default:
      currentLogLevel = LOG_LEVEL.NONE;
  }
};

const shouldLog = (level: LOG_LEVEL) => {
  return currentLogLevel & level;
};

const logger = {
  error(...args: Array<any>) {
    if (shouldLog(LOG_LEVEL.ERROR)) {
      currentLogger.error(...args);
    }
  },
  warn(...args: Array<any>) {
    if (shouldLog(LOG_LEVEL.WARN)) {
      currentLogger.warn(...args);
    }
  },
  log(...args: Array<any>) {
    if (shouldLog(LOG_LEVEL.LOG)) {
      currentLogger.log(...args);
    }
  },
  success(...args: Array<any>) {
    if (shouldLog(LOG_LEVEL.LOG)) {
      currentLogger.success(...args);
    }
  },
  info(...args: Array<any>) {
    if (shouldLog(LOG_LEVEL.LOG)) {
      currentLogger.info(...args);
    }
  },
  debug(...args: Array<any>) {
    if (shouldLog(LOG_LEVEL.DEBUG)) {
      currentLogger.debug(...args);
    }
  },
  group(...args: Array<any>) {
    currentLogger.group(...args);
  },
  groupEnd() {
    currentLogger.groupEnd();
  },
};

export { LOG_LEVEL, Styles, setLogger, setLogLevel, logger };

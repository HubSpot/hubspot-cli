const chalk = require('chalk');

const LOG_LEVEL = {
  NONE: 0,
  DEBUG: 1,
  LOG: 2,
  WARN: 4,
  ERROR: 8,
};

/**
 * Chalk styles for logger strings.
 */
const Styles = {
  debug: chalk.reset.blue,
  log: chalk.reset,
  success: chalk.reset.green,
  info: chalk.reset.white,
  warn: chalk.reset.yellow,
  error: chalk.reset.red,
};

const stylize = (label, style, args) => {
  const styledLabel = style(label);
  const [firstArg, ...rest] = args;
  if (typeof firstArg === 'string') {
    return [`${styledLabel} ${firstArg}`, ...rest];
  }
  return [styledLabel, ...args];
};

class Logger {
  error(...args) {
    console.error(...stylize('[ERROR]', Styles.error, args));
  }
  warn(...args) {
    console.warn(...stylize('[WARNING]', Styles.warn, args));
  }
  log(...args) {
    console.log(...args);
  }
  success(...args) {
    console.log(...stylize('[SUCCESS]', Styles.success, args));
  }
  info(...args) {
    console.info(...stylize('[INFO]', Styles.info, args));
  }
  debug(...args) {
    console.debug(...stylize('[DEBUG]', Styles.log, args));
  }
  group(...args) {
    console.group(...args);
  }
  groupEnd(...args) {
    console.groupEnd(...args);
  }
}

let currentLogger = new Logger();
let currentLogLevel = LOG_LEVEL.ERROR;

const setLogger = logger => {
  currentLogger = logger;
};

const setLogLevel = level => {
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

const shouldLog = level => {
  return currentLogLevel & level;
};

const getLogLevel = () => {
  switch (currentLogLevel) {
    case LOG_LEVEL.DEBUG | LOG_LEVEL.LOG | LOG_LEVEL.WARN | LOG_LEVEL.ERROR:
      return LOG_LEVEL.DEBUG;
    case LOG_LEVEL.LOG | LOG_LEVEL.WARN | LOG_LEVEL.ERROR:
      return LOG_LEVEL.LOG;
    case LOG_LEVEL.WARN | LOG_LEVEL.ERROR:
      return LOG_LEVEL.WARN;
    case LOG_LEVEL.ERROR:
      return LOG_LEVEL.ERROR;
    default:
      return LOG_LEVEL.NONE;
  }
};
const logger = {
  error(...args) {
    if (shouldLog(LOG_LEVEL.ERROR)) {
      currentLogger.error(...args);
    }
  },
  warn(...args) {
    if (shouldLog(LOG_LEVEL.WARN)) {
      currentLogger.warn(...args);
    }
  },
  log(...args) {
    if (shouldLog(LOG_LEVEL.LOG)) {
      currentLogger.log(...args);
    }
  },
  success(...args) {
    if (shouldLog(LOG_LEVEL.LOG)) {
      currentLogger.success(...args);
    }
  },
  info(...args) {
    if (shouldLog(LOG_LEVEL.LOG)) {
      currentLogger.info(...args);
    }
  },
  debug(...args) {
    if (shouldLog(LOG_LEVEL.DEBUG)) {
      currentLogger.debug(...args);
    }
  },
  group(...args) {
    currentLogger.group(...args);
  },
  groupEnd(...args) {
    currentLogger.groupEnd(...args);
  },
};

module.exports = {
  LOG_LEVEL,
  Styles,
  setLogger,
  setLogLevel,
  getLogLevel,
  logger,
};

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
  logger,
};

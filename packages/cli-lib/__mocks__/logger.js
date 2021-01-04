const util = require('util');

const logger = jest.genMockFromModule('../logger');

const { LOG_LEVEL } = logger;

const logs = {
  [LOG_LEVEL.DEBUG]: [],
  [LOG_LEVEL.LOG]: [],
  [LOG_LEVEL.WARN]: [],
  [LOG_LEVEL.ERROR]: [],
};

function log(level, args) {
  const message = util.format(...args);
  logs[level].push(message);
  return message;
}

logger.logger = {
  get logs() {
    return Object.keys(logs).reduce((hash, level) => {
      hash[level] = logs[level].slice();
      return hash;
    }, {});
  },

  clear() {
    Object.keys(logs).forEach(level => {
      logs[level] = [];
    });
  },

  error(...args) {
    return log(LOG_LEVEL.ERROR, args);
  },

  warn(...args) {
    return log(LOG_LEVEL.WARN, args);
  },

  log(...args) {
    return log(LOG_LEVEL.LOG, args);
  },

  debug(...args) {
    return log(LOG_LEVEL.DEBUG, args);
  },
};

module.exports = logger;

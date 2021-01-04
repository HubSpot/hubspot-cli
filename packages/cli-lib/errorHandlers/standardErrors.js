const { HubSpotAuthError } = require('../lib/models/Errors');
const { logger } = require('../logger');

const isSystemError = err =>
  err.errno != null && err.code != null && err.syscall != null;
const isFatalError = err => err instanceof HubSpotAuthError;

// TODO: Make these TS interfaces
class ErrorContext {
  constructor(props = {}) {
    /** @type {number} */
    this.accountId = props.accountId;
  }
}

/**
 * Logs (debug) the error and context objects.
 *
 * @param {SystemError}  error
 * @param {ErrorContext} context
 */
function debugErrorAndContext(error, context) {
  if (error.name === 'StatusCodeError') {
    const { statusCode, message, response } = error;
    logger.debug('Error: %o', {
      statusCode,
      message,
      url: response.request.href,
      method: response.request.method,
      response: response.body,
      headers: response.headers,
    });
  } else {
    logger.debug('Error: %o', error);
  }
  logger.debug('Context: %o', context);
}

/**
 * Logs a SystemError
 * @see {@link https://nodejs.org/api/errors.html#errors_class_systemerror}
 *
 * @param {SystemError}  error
 * @param {ErrorContext} context
 */
function logSystemError(error, context) {
  logger.error(`A system error has occurred: ${error.message}`);
  debugErrorAndContext(error, context);
}

/**
 * Logs a message for an error instance of type not asserted.
 *
 * @param {Error|SystemError|Object} error
 * @param {ErrorContext}             context
 */
function logErrorInstance(error, context) {
  // SystemError
  if (isSystemError(error)) {
    logSystemError(error, context);
    return;
  }
  if (error instanceof Error || error.message || error.reason) {
    // Error or Error subclass
    const name = error.name || 'Error';
    const message = [`A ${name} has occurred.`];
    [error.message, error.reason].forEach(msg => {
      if (msg) {
        message.push(msg);
      }
    });
    logger.error(message.join(' '));
  } else {
    // Unknown errors
    logger.error(`An unknown error has occurred.`);
  }
  debugErrorAndContext(error, context);
}

module.exports = {
  debugErrorAndContext,
  ErrorContext,
  isFatalError,
  isSystemError,
  logErrorInstance,
};

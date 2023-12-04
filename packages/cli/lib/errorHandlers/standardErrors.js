const util = require('util');
const { HubSpotAuthError } = require('@hubspot/cli-lib/lib/models/Errors');
const { logger } = require('@hubspot/cli-lib/logger');
const { i18n } = require('../lang');

const i18nKey = 'cli.lib.errorHandlers.standardErrors';

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
    logger.debug(
      i18n(`${i18nKey}.errorOccurred`, {
        error: {
          statusCode,
          message,
          url: response.request.href,
          method: response.request.method,
          response: response.body,
          headers: response.headers,
        },
      })
    );
  } else {
    logger.debug(i18n(`${i18nKey}.errorOccurred`, { error }));
  }
  if (error.cause) {
    logger.debug(
      i18n(`${i18nKey}.errorCause`, {
        cause: util.inspect(error.cause, false, null, true),
      })
    );
  }
  logger.debug(
    i18n(`${i18nKey}.errorContext`, {
      context: util.inspect(context, false, null, true),
    })
  );
}

/**
 * Logs a SystemError
 * @see {@link https://nodejs.org/api/errors.html#errors_class_systemerror}
 *
 * @param {SystemError}  error
 * @param {ErrorContext} context
 */
function logSystemError(error, context) {
  logger.error(
    i18n(`${i18nKey}.systemErrorOccurred`, { error: error.message })
  );
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
    const message = [i18n(`${i18nKey}.genericErrorOccurred`, { name })];
    [error.message, error.reason].forEach(msg => {
      if (msg) {
        message.push(msg);
      }
    });
    logger.error(message.join(' '));
  } else {
    // Unknown errors
    logger.error(i18n(`${i18nKey}.unknownErrorOccurred`));
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

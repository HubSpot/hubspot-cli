const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  isHubSpotHttpError,
  isSystemError,
  isFileSystemError,
  isValidationError,
  isMissingScopeError,
} = require('@hubspot/local-dev-lib/errors/index');
const { shouldSuppressError } = require('./suppressError');
const { i18n } = require('../lang');
const util = require('node:util');
const { isAxiosError } = require('axios');

const i18nKey = 'lib.errorHandlers.index';

function logError(error, context = {}) {
  debugError(error, context);

  if (shouldSuppressError(error)) {
    return;
  }

  if (isHubSpotHttpError(error) && context) {
    error.updateContext(context);
  }

  if (isHubSpotHttpError(error) || isFileSystemError(error)) {
    if (isValidationError(error) || isMissingScopeError(error)) {
      logger.error(error.formattedValidationErrors());
    } else {
      logger.error(error.message);
    }
  } else if (isSystemError(error)) {
    logger.error(error.message);
  } else if (error instanceof Error || error.message || error.reason) {
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
}

/**
 * Logs (debug) the error and context objects.
 *
 * @param {Error}  error
 * @param {ApiErrorContext} context
 */
function debugError(error, context = {}) {
  if (isHubSpotHttpError(error)) {
    logger.debug(error.toString());
  } else {
    logger.debug(i18n(`${i18nKey}.errorOccurred`, { error }));
  }

  if (error.cause) {
    logger.debug(
      i18n(`${i18nKey}.errorCause`, {
        cause: isAxiosError(error.cause)
          ? error.cause
          : util.inspect(error.cause, false, null, true),
      })
    );
  }
  if (context) {
    logger.debug(
      i18n(`${i18nKey}.errorContext`, {
        context: util.inspect(context, false, null, true),
      })
    );
  }
}

class ApiErrorContext {
  constructor(props = {}) {
    /** @type {number} */
    this.accountId = props.accountId;
    /** @type {string} */
    this.request = props.request || '';
    /** @type {string} */
    this.payload = props.payload || '';
    /** @type {string} */
    this.projectName = props.projectName || '';
  }
}

module.exports = {
  logError,
  debugError,
  ApiErrorContext,
};

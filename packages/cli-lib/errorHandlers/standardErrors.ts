const { HubSpotAuthError } = require('../lib/models/Errors');
import { logger } from '../logger';
import { StatusCodeError, ErrorContext } from '../types';

const isSystemError = (err: NodeJS.ErrnoException) =>
  err.errno != null && err.code != null && err.syscall != null;
const isFatalError = (err: NodeJS.ErrnoException) =>
  err instanceof HubSpotAuthError;

function debugErrorAndContext(error: StatusCodeError, context: ErrorContext) {
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

function logSystemError(error: StatusCodeError, context: ErrorContext) {
  logger.error(`A system error has occurred: ${error.message}`);
  debugErrorAndContext(error, context);
}

function logErrorInstance(error: any, context: ErrorContext) {
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

export {
  debugErrorAndContext,
  ErrorContext,
  isFatalError,
  isSystemError,
  logErrorInstance,
};

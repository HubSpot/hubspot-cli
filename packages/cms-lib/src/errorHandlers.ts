import { HubSpotAuthError } from '@hubspot/api-auth-lib/Errors';
import { logger } from './logger';

const isApiStatusCodeError = err =>
  err.name === 'StatusCodeError' ||
  (err.statusCode >= 100 && err.statusCode < 600);
const isApiUploadValidationError = err =>
  !!(
    err.statusCode === 400 &&
    err.response &&
    err.response.body &&
    (err.response.body.message || err.response.body.errors)
  );
const isSystemError = err =>
  err.errno != null && err.code != null && err.syscall != null;
const contactSupportString =
  'Please try again or visit https://help.hubspot.com/ to submit a ticket or contact HubSpot Support if the issue persists.';

export const isFatalError = err => err instanceof HubSpotAuthError;
export const parseValidationErrors = (responseBody = {}) => {
  const errorMessages = [];

  const { errors, message } = responseBody;

  if (message) {
    errorMessages.push(message);
  }

  if (errors) {
    const specificErrors = errors.map(error => {
      let errorMessage = error.message;
      if (error.errorTokens && error.errorTokens.line) {
        errorMessage = `line ${error.errorTokens.line}: ${errorMessage}`;
      }
      return errorMessage;
    });
    errorMessages.push(...specificErrors);
  }

  return errorMessages;
};

// TODO: Make these TS interfaces
export class ErrorContext {
  constructor(props = {}) {
    /** @type {number} */
    this.portalId = props.portalId;
  }
}

export class ApiErrorContext extends ErrorContext {
  constructor(props = {}) {
    super(props);
    /** @type {string} */
    this.request = props.request || '';
    /** @type {string} */
    this.payload = props.payload || '';
  }
}

export class FileSystemErrorContext extends ErrorContext {
  constructor(props = {}) {
    super(props);
    /** @type {string} */
    this.filepath = props.filepath || '';
    /** @type {boolean} */
    this.read = !!props.read;
    /** @type {boolean} */
    this.write = !!props.write;
  }
}

/**
 * Logs (debug) the error and context objects.
 *
 * @param {SystemError}  error
 * @param {ErrorContext} context
 */
export function debugErrorAndContext(error, context) {
  logger.debug('Error: %o', error);
  logger.debug('Context: %o', context);
}

/**
 * Logs a SystemError
 * @see {@link https://nodejs.org/api/errors.html#errors_class_systemerror}
 *
 * @param {SystemError}  error
 * @param {ErrorContext} context
 */
export function logSystemError(error, context) {
  logger.error(`A system error has occurred: ${error.message}`);
  debugErrorAndContext(error, context);
}

/**
 * Logs a message for an error instance of type not asserted.
 *
 * @param {Error|SystemError|Object} error
 * @param {ErrorContext}             context
 */
export function logErrorInstance(error, context) {
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

/**
 * @param {Error}           error
 * @param {ApiErrorContext} context
 */
function logValidationErrors(error, context) {
  const { response = {} } = error;
  const validationErrors = parseValidationErrors(response.body);
  if (validationErrors.length) {
    validationErrors.forEach(err => {
      logger.error(err);
    });
  }
  debugErrorAndContext(error, context);
}

/**
 * Message segments for API messages.
 *
 * @enum {string}
 */
const ApiMethodVerbs = {
  DEFAULT: 'request',
  DELETE: 'delete',
  GET: 'request',
  PATCH: 'update',
  POST: 'post',
  PUT: 'update',
};

/**
 * Message segments for API messages.
 *
 * @enum {string}
 */
const ApiMethodPrepositions = {
  DEFAULT: 'for',
  DELETE: 'of',
  GET: 'for',
  PATCH: 'to',
  POST: 'to',
  PUT: 'to',
};

/**
 * Logs messages for an error instance resulting from API interaction.
 *
 * @param {StatusCodeError} error
 * @param {ApiErrorContext} context
 */
function logApiStatusCodeError(error, context) {
  const { statusCode } = error;
  const { method } = error.options || {};
  const isPutOrPost = method === 'PUT' || method === 'POST';
  const action = ApiMethodVerbs[method] || ApiMethodVerbs.DEFAULT;
  const preposition =
    ApiMethodPrepositions[method] || ApiMethodPrepositions.DEFAULT;
  let messageDetail = '';
  {
    const request = context.request
      ? `${action} ${preposition} "${context.request}"`
      : action;
    messageDetail = `${request} in portal ${context.portalId}`;
  }
  const errorMessage = [];
  if (isPutOrPost && context.payload) {
    errorMessage.push(`Unable to upload "${context.payload}".`);
  }
  switch (statusCode) {
    case 400:
      errorMessage.push(`The ${messageDetail} was bad.`);
      break;
    case 401:
      errorMessage.push(`The ${messageDetail} was unauthorized.`);
      break;
    case 403:
      errorMessage.push(`The ${messageDetail} was forbidden.`);
      break;
    case 404:
      if (context.request) {
        errorMessage.push(
          `The ${action} failed because "${context.request}" was not found in portal ${context.portalId}.`
        );
      } else {
        errorMessage.push(`The ${messageDetail} was not found.`);
      }
      break;
    case 503:
      errorMessage.push(
        `The ${messageDetail} could not be handled at this time. ${contactSupportString}`
      );
      break;
    default:
      if (statusCode >= 500 && statusCode < 600) {
        errorMessage.push(
          `The ${messageDetail} failed due to a server error. ${contactSupportString}`
        );
      } else if (statusCode >= 400 && statusCode < 500) {
        errorMessage.push(`The ${messageDetail} failed due to a client error.`);
      } else {
        errorMessage.push(`The ${messageDetail} failed.`);
      }
      break;
  }
  if (error.error && error.error.message) {
    errorMessage.push(error.error.message);
  }
  logger.error(errorMessage.join(' '));
  debugErrorAndContext(error, context);
}

/**
 * Logs a message for an error instance resulting from API interaction.
 *
 * @param {Error|SystemError|Object} error
 * @param {ApiErrorContext}          context
 */
export function logApiErrorInstance(error, context) {
  // StatusCodeError
  if (isApiStatusCodeError(error)) {
    logApiStatusCodeError(error, context);
    return;
  }
  logErrorInstance(error, context);
}

/**
 * Logs a message for an error instance resulting from filemapper API upload.
 *
 * @param {Error|SystemError|Object} error
 * @param {ApiErrorContext}          context
 */
export function logApiUploadErrorInstance(error, context) {
  if (isApiUploadValidationError(error)) {
    logValidationErrors(error, context);
    return;
  }
  logApiErrorInstance(error, context);
}

/**
 * Logs a message for an error instance resulting from filesystem interaction.
 *
 * @param {Error|SystemError|Object} error
 * @param {FileSystemErrorContext}   context
 */
export function logFileSystemErrorInstance(error, context) {
  let fileAction = '';
  if (context.read) {
    fileAction = 'reading from';
  } else if (context.write) {
    fileAction = 'writing to';
  } else {
    fileAction = 'accessing';
  }
  const filepath = context.filepath
    ? `"${context.filepath}"`
    : 'a file or folder';
  const message = [`An error occurred while ${fileAction} ${filepath}.`];
  // Many `fs` errors will be `SystemError`s
  if (isSystemError(error)) {
    message.push(`This is the result of a system error: ${error.message}`);
  }
  logger.error(message.join(' '));
  debugErrorAndContext(error, context);
}

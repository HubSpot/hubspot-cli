const { HubSpotAuthError } = require('./lib/models/Errors');
const { logger } = require('./logger');
const { getPortalConfig } = require('./lib/config');
const {
  SCOPE_GROUPS,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} = require('./lib/constants.js');
const { fetchScopeData } = require('./api/localDevAuth/authenticated');

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
const isFatalError = err => err instanceof HubSpotAuthError;
const isMissingScopeError = err =>
  err.name === 'StatusCodeError' &&
  err.statusCode === 403 &&
  err.error.category === 'MISSING_SCOPES';
const contactSupportString =
  'Please try again or visit https://help.hubspot.com/ to submit a ticket or contact HubSpot Support if the issue persists.';

const parseValidationErrors = (responseBody = {}) => {
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
class ErrorContext {
  constructor(props = {}) {
    /** @type {number} */
    this.portalId = props.portalId;
  }
}

class ApiErrorContext extends ErrorContext {
  constructor(props = {}) {
    super(props);
    /** @type {string} */
    this.request = props.request || '';
    /** @type {string} */
    this.payload = props.payload || '';
  }
}

class FileSystemErrorContext extends ErrorContext {
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
function logApiErrorInstance(error, context) {
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
function logApiUploadErrorInstance(error, context) {
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
function logFileSystemErrorInstance(error, context) {
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

async function verifyAccessKeyAndUserAccess(portalId, scopeGroup) {
  const portalConfig = getPortalConfig(portalId);
  const { authType } = portalConfig;
  if (authType !== PERSONAL_ACCESS_KEY_AUTH_METHOD.value) {
    return;
  }

  let scopesData;
  try {
    scopesData = await fetchScopeData(portalId, scopeGroup);
  } catch (e) {
    logger.debug('Error verifying function access');
    return;
  }
  const { portalScopesInGroup, userScopesInGroup } = scopesData;

  if (!portalScopesInGroup.length) {
    logger.error(
      'Your account does not have access to this action. Talk to an account admin to request it.'
    );
    return;
  }

  if (!portalScopesInGroup.every(s => userScopesInGroup.includes(s))) {
    logger.error(
      "You don't have access to this action. Ask an account admin to change your permissions in Users & Teams settings."
    );
    return;
  } else {
    logger.error(
      'Your access key does not allow this action. Please generate a new access key by running "hs auth personalaccesskey".'
    );
    return;
  }
}

/**
 * Logs a message for an error instance resulting from API interaction
 * related to serverless function.
 *
 * @param {int} portalId
 * @param {Error|SystemError|Object} error
 * @param {ApiErrorContext}          context
 */
async function logServerlessFunctionApiErrorInstance(portalId, error, context) {
  if (isMissingScopeError(error)) {
    await verifyAccessKeyAndUserAccess(portalId, SCOPE_GROUPS.functions);
    return;
  }

  // StatusCodeError
  if (isApiStatusCodeError(error)) {
    logApiStatusCodeError(error, context);
    return;
  }
  logErrorInstance(error, context);
}

module.exports = {
  ErrorContext,
  ApiErrorContext,
  FileSystemErrorContext,
  isFatalError,
  parseValidationErrors,
  logErrorInstance,
  logApiErrorInstance,
  logApiUploadErrorInstance,
  logFileSystemErrorInstance,
  logServerlessFunctionApiErrorInstance,
};

const { logger } = require('@hubspot/cli-lib/logger');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');
const {
  SCOPE_GROUPS,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} = require('@hubspot/cli-lib/lib/constants');
const {
  fetchScopeData,
} = require('@hubspot/cli-lib/api/localDevAuth/authenticated');
const {
  debugErrorAndContext,
  logErrorInstance,
  ErrorContext,
} = require('./standardErrors');
const { i18n } = require('../lang');

const i18nKey = 'cli.lib.errorHandlers.apiErrors';

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

const isMissingScopeError = err =>
  err.name === 'StatusCodeError' &&
  err.statusCode === 403 &&
  err.error &&
  err.error.category === 'MISSING_SCOPES';

const isGatingError = err =>
  isSpecifiedError(err, { statusCode: 403, category: 'GATED' });

const isSpecifiedError = (err, { statusCode, category, subCategory } = {}) => {
  const statusCodeErr = !statusCode || err.statusCode === statusCode;
  const categoryErr =
    !category || (err.error && err.error.category === category);
  const subCategoryErr =
    !subCategory || (err.error && err.error.subCategory === subCategory);

  return (
    err.name === 'StatusCodeError' &&
    statusCodeErr &&
    categoryErr &&
    subCategoryErr
  );
};

const isSpecifiedHubSpotAuthError = (
  err,
  { statusCode, category, subCategory }
) => {
  const statusCodeErr = !statusCode || err.statusCode === statusCode;
  const categoryErr = !category || err.category === category;
  const subCategoryErr = !subCategory || err.subCategory === subCategory;
  return (
    err.name === 'HubSpotAuthError' &&
    statusCodeErr &&
    categoryErr &&
    subCategoryErr
  );
};

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

class ApiErrorContext extends ErrorContext {
  constructor(props = {}) {
    super(props);
    /** @type {string} */
    this.request = props.request || '';
    /** @type {string} */
    this.payload = props.payload || '';
    /** @type {string} */
    this.projectName = props.projectName || '';
  }
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
  const { projectName } = context;
  const isPutOrPost = method === 'PUT' || method === 'POST';
  const action = ApiMethodVerbs[method] || ApiMethodVerbs.DEFAULT;
  const preposition =
    ApiMethodPrepositions[method] || ApiMethodPrepositions.DEFAULT;
  let messageDetail = '';
  {
    const request = context.request
      ? `${action} ${preposition} "${context.request}"`
      : action;
    messageDetail = `${request} in account ${context.accountId}`;
  }
  const errorMessage = [];
  if (isPutOrPost && context.payload) {
    errorMessage.push(`Unable to upload "${context.payload}".`);
  }
  const isProjectMissingScopeError = isMissingScopeError(error) && projectName;
  const isProjectGatingError = isGatingError(error) && projectName;
  switch (statusCode) {
    case 400:
      errorMessage.push(i18n(`${i18nKey}.codes.400`, { messageDetail }));
      break;
    case 401:
      errorMessage.push(i18n(`${i18nKey}.codes.401`, { messageDetail }));
      break;
    case 403:
      if (isProjectMissingScopeError) {
        errorMessage.push(
          i18n(`${i18nKey}.codes.403MissingScope`, {
            accountId: context.accountId || '',
          })
        );
      } else if (isProjectGatingError) {
        errorMessage.push(
          i18n(`${i18nKey}.codes.403Gating`, {
            accountId: context.accountId || '',
          })
        );
      } else {
        errorMessage.push(i18n(`${i18nKey}.codes.403`, { messageDetail }));
      }
      break;
    case 404:
      if (context.request) {
        errorMessage.push(
          i18n(`${i18nKey}.codes.404Request`, {
            action: action || 'request',
            request: context.request,
            account: context.accountId || '',
          })
        );
      } else {
        errorMessage.push(i18n(`${i18nKey}.codes.404`, { messageDetail }));
      }
      break;
    case 429:
      errorMessage.push(i18n(`${i18nKey}.codes.429`, { messageDetail }));
      break;
    case 503:
      errorMessage.push(i18n(`${i18nKey}.codes.503`, { messageDetail }));
      break;
    default:
      if (statusCode >= 500 && statusCode < 600) {
        errorMessage.push(
          i18n(`${i18nKey}.codes.500Generic`, { messageDetail })
        );
      } else if (statusCode >= 400 && statusCode < 500) {
        i18n(`${i18nKey}.codes.400Generic`, { messageDetail });
      } else {
        errorMessage.push(i18n(`${i18nKey}.codes.generic`, { messageDetail }));
      }
      break;
  }
  if (
    error.error &&
    error.error.message &&
    !isProjectMissingScopeError &&
    !isProjectGatingError
  ) {
    errorMessage.push(error.error.message);
  }
  if (error.error && error.error.errors) {
    error.error.errors.forEach(err => {
      errorMessage.push('\n- ' + err.message);
    });
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

async function verifyAccessKeyAndUserAccess(accountId, scopeGroup) {
  const accountConfig = getAccountConfig(accountId);
  const { authType } = accountConfig;
  if (authType !== PERSONAL_ACCESS_KEY_AUTH_METHOD.value) {
    return;
  }

  let scopesData;
  try {
    scopesData = await fetchScopeData(accountId, scopeGroup);
  } catch (e) {
    logger.debug(
      i18n(`${i18nKey}.verifyAccessKeyAndUserAccess.fetchScopeDataError`, {
        scopeGroup,
        error: e,
      })
    );
    return;
  }
  const { portalScopesInGroup, userScopesInGroup } = scopesData;

  if (!portalScopesInGroup.length) {
    logger.error(
      i18n(`${i18nKey}.verifyAccessKeyAndUserAccess.portalMissingScope`)
    );
    return;
  }

  if (!portalScopesInGroup.every(s => userScopesInGroup.includes(s))) {
    logger.error(
      i18n(`${i18nKey}.verifyAccessKeyAndUserAccess.userMissingScope`)
    );
    return;
  } else {
    logger.error(
      i18n(`${i18nKey}.verifyAccessKeyAndUserAccess.genericMissingScope`)
    );
    return;
  }
}

/**
 * Logs a message for an error instance resulting from API interaction
 * related to serverless function.
 *
 * @param {int} accountId
 * @param {Error|SystemError|Object} error
 * @param {ApiErrorContext}          context
 */
async function logServerlessFunctionApiErrorInstance(
  accountId,
  error,
  context
) {
  if (isMissingScopeError(error)) {
    await verifyAccessKeyAndUserAccess(accountId, SCOPE_GROUPS.functions);
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
  ApiErrorContext,
  parseValidationErrors,
  logApiErrorInstance,
  logApiUploadErrorInstance,
  logServerlessFunctionApiErrorInstance,
  isMissingScopeError,
  isSpecifiedError,
  isSpecifiedHubSpotAuthError,
};

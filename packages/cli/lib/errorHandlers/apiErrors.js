const { logger } = require('@hubspot/local-dev-lib/logger');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');
const {
  isMissingScopeError,
  isApiUploadValidationError,
  getAxiosErrorWithContext,
  parseValidationErrors,
} = require('@hubspot/local-dev-lib/errors/apiErrors');
const {
  SCOPE_GROUPS,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} = require('@hubspot/local-dev-lib/constants/auth');
const { fetchScopeData } = require('@hubspot/local-dev-lib/api/localDevAuth');
const {
  debugErrorAndContext,
  logErrorInstance,
  ErrorContext,
} = require('./standardErrors');
const { overrideErrors } = require('./overrideErrors');
const { i18n } = require('../lang');

const i18nKey = 'lib.errorHandlers.apiErrors';

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
  const validationErrors = parseValidationErrors(response.data);
  if (validationErrors.length) {
    logger.error(validationErrors.join('\n- '));
  }
  debugErrorAndContext(error, context);
}

/**
 * Logs a message for an error instance resulting from API interaction.
 *
 * @param {Error|SystemError|Object} error
 * @param {ApiErrorContext}          context
 */
function logApiErrorInstance(error, context) {
  if (error.isAxiosError) {
    if (overrideErrors(error)) return;
    const errorWithContext = getAxiosErrorWithContext(error, context);
    logger.error(errorWithContext.message);
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
    const { data } = await fetchScopeData(accountId, scopeGroup);
    scopesData = data;
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
    await verifyAccessKeyAndUserAccess(accountId, SCOPE_GROUPS.CMS_FUNCTIONS);
    return;
  }

  logApiErrorInstance(error, context);
}

module.exports = {
  ApiErrorContext,
  parseValidationErrors,
  logApiErrorInstance,
  logApiUploadErrorInstance,
  logServerlessFunctionApiErrorInstance,
};

const { logger } = require('../logger');
const { SCOPE_GROUPS } = require('./constants.js');
const { fetchScopeData } = require('../api/scopes');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cms-lib/errorHandlers');

const isMissingScopeError = err =>
  err.name === 'StatusCodeError' &&
  err.statusCode === 403 &&
  err.error.category === 'MISSING_SCOPES';

/**
 *
 * @param {number} portalId
 */
async function getMissingScopeErrorMessage(portalId, error) {
  let scopesResp;

  if (!isMissingScopeError(error)) {
    return null;
  }

  try {
    scopesResp = await fetchScopeData(portalId, SCOPE_GROUPS.functions);
  } catch (e) {
    logger.error('Error verifying function access');
    logApiErrorInstance(
      e,
      new ApiErrorContext({
        request: 'function scope check',
        portalId,
      })
    );
  }

  if (!scopesResp) {
    return false;
  }
  const { portalScopesInGroup, userScopesInGroup } = scopesResp;

  if (!portalScopesInGroup.length) {
    return 'Your personal CMS access key is missing required permissions for this action. Your portal does not have these permissions. If you believe this is in error, please contact your administrator.';
  }

  if (!portalScopesInGroup.every(s => userScopesInGroup.includes(s))) {
    return 'Your personal CMS access key is missing required permissions for this action. Your user account does not have the required permissions. If you believe this is in error, please contact your administrator.';
  } else {
    return 'Your personal CMS access key is missing required permissions for this action. Your user access token does not have the required permissions. Please generate a new access key to add them by running "hs auth personalaccesskey". If you believe this is in error, please contact your administrator.';
  }
}

module.exports = {
  getMissingScopeErrorMessage,
};

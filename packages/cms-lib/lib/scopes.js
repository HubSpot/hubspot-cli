const { logger } = require('../logger');
const { SCOPE_GROUPS } = require('./constants.js');
const { fetchScopeData, fetchScopesForScopeGroup } = require('../api/scopes');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cms-lib/errorHandlers');

/**
 *
 * @param {number} portalId
 */
async function getMissingScopeErrorMessage(portalId) {
  let scopesResp;
  let requiredScopes;

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

  try {
    requiredScopes = await fetchScopesForScopeGroup(
      portalId,
      SCOPE_GROUPS.functions
    );
  } catch (e) {
    logger.error('Error fetching scopes');
    logApiErrorInstance(
      e,
      new ApiErrorContext({
        request: 'fetch required scopes',
        portalId,
      })
    );
  }

  if (!scopesResp) {
    return false;
  }
  console.log('requiredScopes: ', requiredScopes);
  const { portalScopesInGroup, userScopesInGroup } = scopesResp;
  const portalHasRequiredScopes = requiredScopes.every(s =>
    portalScopesInGroup.includes(s)
  );
  const userHasRequiredScopes = requiredScopes.every(s =>
    userScopesInGroup.includes(s)
  );
  console.log('scopesResp: ', scopesResp);

  if (!portalHasRequiredScopes) {
    logger.error(
      'Your personal CMS access key is missing required permissions for this action. Your account does not have these permissions. If you believe this is in error, please contact your administrator.'
    );
    return false;
  }

  if (!userHasRequiredScopes) {
    logger.error(
      'Your personal CMS access key is missing required permissions for this action. Your user may not have these permissions or you may need to generate a new access key to add them. You can do so by running "hs auth personalaccesskey". If you believe this is in error, please contact your administrator.'
    );
  }

  return portalHasRequiredScopes && userHasRequiredScopes;
}

module.exports = {
  getMissingScopeErrorMessage,
};

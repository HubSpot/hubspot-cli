const { logger } = require('../logger');
const { SCOPES, SCOPE_GROUPS } = require('./constants.js');
const { fetchScopeData } = require('../api/scopes');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cms-lib/errorHandlers');

/**
 *
 * @param {number} portalId
 * @param {string} scopeGroup
 * @param {array} scopes
 */
async function verifyFunctionScopesExist(
  portalId,
  options = {
    requiredScopes: Object.values(SCOPES.functions),
  }
) {
  let scopesResp;

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

  const { portalScopesInGroup, userScopesInGroup } = scopesResp;
  const portalHasRequiredScopes = options.requiredScopes.every(s =>
    portalScopesInGroup.includes(s)
  );
  const userHasRequiredScopes = options.requiredScopes.every(s =>
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
  verifyFunctionScopesExist,
};

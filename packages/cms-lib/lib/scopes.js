const { logger } = require('../logger');
const {
  SCOPE_GROUPS,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} = require('./constants.js');
const { fetchScopeData } = require('../api/localDevAuth/authenticated');
const { logApiErrorInstance, ApiErrorContext } = require('../errorHandlers');
const { getPortalConfig } = require('./config');

/**
 *
 * @param {number} portalId
 */
async function getScopeDataForFunctions(portalId) {
  const portalConfig = getPortalConfig(portalId);
  const { authType } = portalConfig;
  if (authType !== PERSONAL_ACCESS_KEY_AUTH_METHOD.value) {
    return null;
  }
  try {
    return await fetchScopeData(portalId, SCOPE_GROUPS.functions);
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
}

module.exports = {
  getScopeDataForFunctions,
};

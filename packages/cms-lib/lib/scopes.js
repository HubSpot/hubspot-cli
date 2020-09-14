const { logger } = require('../logger');
const { SCOPE_GROUPS } = require('./constants.js');
const { fetchScopeData } = require('../api/localDevAuth/authenticated');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cms-lib/errorHandlers');

/**
 *
 * @param {number} portalId
 */
async function getScopeDataForFunctions(portalId) {
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

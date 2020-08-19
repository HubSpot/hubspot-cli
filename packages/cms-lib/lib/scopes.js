// const { fetchAuth } = require('../api/auth');
const { fetchScopes } = require('../api/scopes');

// const { getPortalConfig } = require('./config');
/**
 *
 * @param {number} portalId
 * @param {string} scopeGroup
 * @param {array} scopes
 */
async function verifyFunctionScopesExist(portalId, scopeGroup, scopes) {
  // const { personalAccessKey } = getPortalConfig(portalId);
  // const authResp = await fetchAuth(portalId, personalAccessKey);
  // console.log('Auth Resp: ', authResp);
  // const { userId } = authResp;

  const scopesResp = await fetchScopes(portalId, scopeGroup);

  if (Array.prototype.hasOwnProperty.call(scopesResp, 'length')) {
    return scopes.every(s => scopesResp.includes(s));
  }

  return false;
}

module.exports = {
  verifyFunctionScopesExist,
};

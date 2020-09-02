const http = require('../http');

async function fetchScopeData(portalId, scopeGroup) {
  return http.get(portalId, {
    uri: `localdevauth/v1/auth/check-scopes`,
    query: {
      scopeGroup,
    },
  });
}

async function fetchScopesForScopeGroup(portalId, scopeGroup) {
  return http.get(portalId, {
    uri: `localdevauth/v1/auth/scopes/${scopeGroup}`,
    query: {
      portalId,
    },
  });
}

module.exports = {
  fetchScopeData,
  fetchScopesForScopeGroup,
};

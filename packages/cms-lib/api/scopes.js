const http = require('../http');

async function fetchScopeData(portalId, scopeGroup) {
  return http.get(portalId, {
    uri: `localdevauth/v1/auth/check-scopes`,
    query: {
      scopeGroup,
    },
  });
}

module.exports = {
  fetchScopeData,
};

const http = require('../../http');

async function fetchScopeData(accountId, scopeGroup) {
  return http.get(accountId, {
    uri: `localdevauth/v1/auth/check-scopes`,
    query: {
      scopeGroup,
    },
  });
}

module.exports = {
  fetchScopeData,
};

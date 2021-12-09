const http = require('../../http');

async function fetchScopeData(accountId, scopeGroup) {
  return http.get(accountId, {
    url: `localdevauth/v1/auth/check-scopes`,
    params: {
      scopeGroup,
    },
  });
}

module.exports = {
  fetchScopeData,
};

const http = require('../http');
const LOCALDEVAUTH_API_PATH = 'localdevauth/v1';

async function fetchAuth(portalId) {
  return http.get(portalId, {
    uri: `${LOCALDEVAUTH_API_PATH}/auth`,
    // Asked Wensheng about proper way to obtain function scope info
    // uri: `${LOCALDEVAUTH_API_PATH}/auth/scopes/{scopeGroup}`,
  });
}

module.exports = {
  fetchAuth,
};

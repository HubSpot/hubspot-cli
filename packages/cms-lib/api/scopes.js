const http = require('../http');
const LOCALDEVAUTH_API_SCOPES_PATH = 'localdevauth/v1/auth/scopes';

async function fetchScopes(portalId, scopeGroup) {
  return http.get(portalId, {
    uri: `${LOCALDEVAUTH_API_SCOPES_PATH}/${scopeGroup}`,
  });
}

module.exports = {
  fetchScopes,
};

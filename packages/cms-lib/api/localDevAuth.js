// const http = require('../http');
const request = require('request-promise-native');
const { getRequestOptions } = require('../http/requestOptions');
const { ENVIRONMENTS } = require('../lib/constants');

const LOCALDEVAUTH_API_AUTH_PATH = 'localdevauth/v1/auth';

async function fetchAccessToken(
  personalAccessKey,
  env = ENVIRONMENTS.PROD,
  portalId
) {
  const query = portalId ? { portalId } : {};
  const requestOptions = getRequestOptions(
    { env },
    {
      uri: `${LOCALDEVAUTH_API_AUTH_PATH}/refresh`,
      body: {
        encodedOAuthRefreshToken: personalAccessKey,
      },
      qs: query,
    }
  );

  return request.post(requestOptions);
}

// async function fetchAccessToken(portalId, scopeGroup) {
//   return http.get(portalId, {
//     uri: `localdevauth/v1/auth/check-scopes`,
//     query: {
//       scopeGroup,
//     },
//   });
// }

async function fetchScopeData(
  personalAccessKey,
  env = ENVIRONMENTS.PROD,
  portalId,
  scopeGroup
) {
  const requestOptions = getRequestOptions(
    { env },
    {
      uri: `${LOCALDEVAUTH_API_AUTH_PATH}/check-scopes`,
      body: {
        encodedOAuthRefreshToken: personalAccessKey,
      },
      qs: {
        portalId,
        scopeGroup,
      },
    }
  );

  return request.get(requestOptions);
}

// // api.hubspot.com/localdevauth/v1/auth/scopes/cms.functions.read_write?portalId=6597896

// async function fetchScopeData(portalId, scopeGroup) {
//   return http.get(portalId, {
//     uri: `localdevauth/v1/auth/check-scopes`,
//     query: {
//       scopeGroup,
//     },
//   });
// }

// module.exports = {
//   fetchScopeData,
// };

async function fetchScopesForScopeGroup(
  personalAccessKey,
  env = ENVIRONMENTS.PROD,
  portalId,
  scopeGroup
) {
  const requestOptions = getRequestOptions(
    { env },
    {
      uri: `${LOCALDEVAUTH_API_AUTH_PATH}/scopes/${scopeGroup}`,
      body: {
        encodedOAuthRefreshToken: personalAccessKey,
      },
      qs: {
        portalId,
      },
    }
  );

  return request.get(requestOptions);
}

// async function fetchScopesForScopeGroup(portalId, scopeGroup) {
//   return http.get(portalId, {
//     uri: `localdevauth/v1/auth/check-scopes`,
//     query: {
//       scopeGroup,
//     },
//   });
// }

module.exports = {
  fetchAccessToken,
  fetchScopeData,
  fetchScopesForScopeGroup,
};

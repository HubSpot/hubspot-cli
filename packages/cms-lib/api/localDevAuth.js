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

// async function fetchScopeData(
//   personalAccessKey,
//   env = ENVIRONMENTS.PROD,
//   portalId,
//   scopeGroup
// ) {
//   const requestOptions = getRequestOptions(
//     { env },
//     {
//       uri: `${LOCALDEVAUTH_API_AUTH_PATH}/check-scopes`,
//       body: {
//         encodedOAuthRefreshToken: personalAccessKey,
//       },
//       qs: {
//         portalId,
//         scopeGroup,
//       },
//     }
//   );

//   return request.get(requestOptions);
// }

module.exports = {
  fetchAccessToken,
  // fetchScopeData,
};

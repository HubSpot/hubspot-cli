const request = require('request-promise-native');
const { getRequestOptions } = require('../http/requestOptions');

async function fetchAccessToken(personalAccessKey, env = 'PROD', portalId) {
  const query = portalId ? { portalId } : {};
  const requestOptions = getRequestOptions(
    { env },
    {
      uri: `localdevauth/v1/auth/refresh`,
      body: {
        encodedOAuthRefreshToken: personalAccessKey,
      },
      qs: query,
    }
  );

  return request.post(requestOptions);
}

module.exports = {
  fetchAccessToken,
};

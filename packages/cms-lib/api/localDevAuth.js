const request = require('request-promise-native');
const { getRequestOptions } = require('../http/requestOptions');
const { PROD } = require('../lib/environment');

async function fetchAccessToken(userToken, env = PROD) {
  console.log('Fetch access token: ', env);
  const requestOptions = getRequestOptions(
    { env },
    {
      uri: `localdevauth/v1/auth/refresh`,
      body: {
        encodedOAuthRefreshToken: userToken,
      },
    }
  );

  return request.post(requestOptions);
}

module.exports = {
  fetchAccessToken,
};

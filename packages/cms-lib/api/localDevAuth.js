const request = require('request-promise-native');
const { getRequestOptions } = require('../http/requestOptions');

async function fetchAccessToken(userToken, env = 'PROD') {
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

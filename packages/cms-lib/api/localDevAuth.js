const request = require('request-promise-native');
const { getRequestOptions } = require('../http/requestOptions');
const {
  ENVIRONMENTS: { PROD },
} = require('../lib/constants');

async function fetchAccessToken(personalAccessKey, env = PROD) {
  const requestOptions = getRequestOptions(
    { env },
    {
      uri: `localdevauth/v1/auth/refresh`,
      body: {
        encodedOAuthRefreshToken: personalAccessKey,
      },
    }
  );

  return request.post(requestOptions);
}

module.exports = {
  fetchAccessToken,
};

const request = require('request-promise-native');
const { getRequestOptions } = require('../../http/requestOptions');
const { ENVIRONMENTS } = require('../../lib/constants');

const LOCALDEVAUTH_API_AUTH_PATH = 'localdevauth/v1/auth';

async function fetchAccessToken(
  personalAccessKey,
  env = ENVIRONMENTS.PROD,
  portalId
) {
  const query = portalId ? { portalId } : {};
  const requestOptions = getRequestOptions(
    { env, localHostOverride: true },
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

module.exports = {
  fetchAccessToken,
};

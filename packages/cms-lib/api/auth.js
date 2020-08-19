const request = require('request-promise-native');
const { getRequestOptions } = require('../http/requestOptions');
const { ENVIRONMENTS } = require('../lib/constants');

async function fetchAuth(portalId, personalAccessKey, env = ENVIRONMENTS.PROD) {
  const query = portalId ? { portalId } : {};
  const requestOptions = getRequestOptions(
    { env },
    {
      uri: `localdevauth/v1/auth`,
      body: {
        encodedOAuthRefreshToken: personalAccessKey,
      },
      qs: query,
    }
  );

  return request.get(requestOptions);
}

module.exports = {
  fetchAuth,
};

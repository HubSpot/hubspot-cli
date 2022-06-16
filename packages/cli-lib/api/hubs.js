const request = require('request-promise-native');
const { getRequestOptions } = require('../http/requestOptions');
const { ENVIRONMENTS } = require('../lib/constants');
const HUBS_API_PATH = 'sandbox-hubs/v1/self';

async function fetchHubData(accessToken, portalId, env = ENVIRONMENTS.PROD) {
  const requestOptions = getRequestOptions(
    { env },
    {
      uri: `${HUBS_API_PATH}`,
      qs: { portalId },
    }
  );
  const reqWithToken = {
    ...requestOptions,
    headers: {
      ...requestOptions.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  };

  return request.get(reqWithToken);
}

module.exports = {
  fetchHubData,
};

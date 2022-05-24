const request = require('request-promise-native');
const { getRequestOptions } = require('../http/requestOptions');
const { ENVIRONMENTS } = require('../lib/constants');
const HUBS_API_PATH = 'hubs2/v1/info/hub';

async function fetchHubData(accessToken, portalId, env = ENVIRONMENTS.PROD) {
  const requestOptions = getRequestOptions(
    { env },
    {
      uri: `${HUBS_API_PATH}/${portalId}`,
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
  console.log('req with token: ', reqWithToken);

  return request.get(reqWithToken);
}

module.exports = {
  fetchHubData,
};

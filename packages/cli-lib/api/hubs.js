const request = require('request-promise-native');
const { getRequestOptions } = require('../http/requestOptions');
const { ENVIRONMENTS } = require('../lib/constants');
const SANDBOX_HUBS_API_PATH = 'sandbox-hubs/v1/self';

async function fetchSandboxHubData(
  accessToken,
  portalId,
  env = ENVIRONMENTS.PROD
) {
  const requestOptions = getRequestOptions(
    { env },
    {
      uri: `${SANDBOX_HUBS_API_PATH}`,
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
  fetchSandboxHubData,
};

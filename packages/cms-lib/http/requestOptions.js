const { version } = require('../package.json');
const { getAndLoadConfigIfNeeded } = require('../lib/config');
const { getHubSpotApiOrigin } = require('../lib/urls');

const getRequestOptions = (options = {}, requestOptions = {}) => {
  const { env } = options;
  const { httpTimeout, httpUseLocalhost } = getAndLoadConfigIfNeeded();
  return {
    baseUrl: getHubSpotApiOrigin(env, httpUseLocalhost),
    headers: {
      'User-Agent': `HubSpot CMS Tools/${version}`,
    },
    json: true,
    simple: true,
    timeout: httpTimeout || 15000,
    ...requestOptions,
  };
};

module.exports = {
  getRequestOptions,
};

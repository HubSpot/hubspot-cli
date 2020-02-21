const { version } = require('../package.json');
const { getAndLoadConfigIfNeeded } = require('../lib/config');
const { getHubSpotApiDomain } = require('../lib/environment');

const getRequestOptions = (options = {}, requestOptions = {}) => {
  const { env } = options;
  const { httpTimeout, httpUseLocalhost } = getAndLoadConfigIfNeeded();
  return {
    baseUrl: getHubSpotApiDomain(env, httpUseLocalhost),
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

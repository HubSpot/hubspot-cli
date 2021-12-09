const { version } = require('../package.json');
const { getAndLoadConfigIfNeeded } = require('../lib/config');
const { getHubSpotApiOrigin } = require('../lib/urls');

const DEFAULT_USER_AGENT_HEADERS = {
  'User-Agent': `HubSpot CLI/${version}`,
};

const getRequestOptions = (options = {}, requestOptions = {}) => {
  const { env } = options;
  const { httpTimeout, httpUseLocalhost } = getAndLoadConfigIfNeeded();
  return {
    baseURL: getHubSpotApiOrigin(env, httpUseLocalhost),
    headers: {
      ...DEFAULT_USER_AGENT_HEADERS,
    },
    json: true,
    simple: true,
    timeout: httpTimeout || 15000,
    ...requestOptions,
  };
};

module.exports = {
  getRequestOptions,
  DEFAULT_USER_AGENT_HEADERS,
};

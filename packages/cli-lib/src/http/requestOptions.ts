import { Environment, RequestOptions } from '../types';
const { version } = require('../package.json');
const { getAndLoadConfigIfNeeded } = require('../lib/config');
const { getHubSpotApiOrigin } = require('../lib/urls');

export const DEFAULT_USER_AGENT_HEADERS = {
  'User-Agent': `HubSpot CLI/${version}`,
};

export const getRequestOptions = (
  options: { env?: Environment } = {},
  requestOptions: RequestOptions = { url: '' }
) => {
  const { env } = options;
  const { httpTimeout, httpUseLocalhost } = getAndLoadConfigIfNeeded();
  return {
    baseUrl: getHubSpotApiOrigin(env, httpUseLocalhost),
    headers: {
      ...DEFAULT_USER_AGENT_HEADERS,
    },
    json: true,
    simple: true,
    timeout: httpTimeout || 15000,
    ...requestOptions,
  };
};

export default { getRequestOptions, DEFAULT_USER_AGENT_HEADERS };

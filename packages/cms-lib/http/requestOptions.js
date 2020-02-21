const { version } = require('../package.json');
const { getAndLoadConfigIfNeeded } = require('../lib/config');

const getRequestOptions = (options = {}, requestOptions = {}) => {
  const { env } = options;
  const { httpTimeout, httpUseLocalhost } = getAndLoadConfigIfNeeded();
  return {
    baseUrl: `https://${httpUseLocalhost ? 'local' : 'api'}.hubapi${
      env === 'QA' ? 'qa' : ''
    }.com`,
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

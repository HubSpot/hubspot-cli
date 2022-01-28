const { ENVIRONMENTS } = require('./constants');

const getEnvUrlString = env => {
  if (typeof env !== 'string') {
    return '';
  }

  return env.toLowerCase() === ENVIRONMENTS.QA ? ENVIRONMENTS.QA : '';
};

const getHubSpotWebsiteOrigin = env => {
  return `https://app.hubspot${getEnvUrlString(env)}.com`;
};

const getHubSpotApiOrigin = (env, useLocalHost) => {
  let domain = process.env.HUBAPI_DOMAIN_OVERRIDE;

  if (!domain || typeof domain !== 'string') {
    domain = `${useLocalHost ? 'local' : 'api'}.hubapi${getEnvUrlString(env)}`;
  }
  return `https://${domain}.com`;
};

module.exports = {
  getHubSpotWebsiteOrigin,
  getHubSpotApiOrigin,
};

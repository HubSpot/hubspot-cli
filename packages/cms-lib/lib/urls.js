const { QA } = require('./constants');

const getEnvUrlString = env => {
  return env === QA ? QA : '';
};

const getHubSpotWebsiteOrigin = env => {
  return `https://app.hubspot${getEnvUrlString(env)}.com`;
};

const getHubSpotApiOrigin = (env, useLocalHost) => {
  return `https://${useLocalHost ? 'local' : 'api'}.hubapi${getEnvUrlString(
    env
  )}.com`;
};

module.exports = {
  getHubSpotWebsiteOrigin,
  getHubSpotApiOrigin,
};

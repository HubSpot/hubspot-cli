'use es6';

const PROD = 'prod';
const QA = 'qa';

const getEnv = env => {
  return typeof env === 'string' && env.toLowerCase() === QA ? QA : PROD;
};

const getHubSpotWebsiteDomain = env => {
  return `https://app.hubspot${getEnv(env) === PROD ? '' : QA}.com`;
};

const getHubSpotApiDomain = (env, useLocalHost) => {
  return `https://${useLocalHost ? 'local' : 'api'}.hubapi${
    getEnv(env) === PROD ? '' : QA
  }.com`;
};

module.exports = {
  PROD,
  QA,
  getEnv,
  getHubSpotWebsiteDomain,
  getHubSpotApiDomain,
};

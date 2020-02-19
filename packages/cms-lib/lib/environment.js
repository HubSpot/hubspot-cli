const { QA, PROD } = require('./constants/environment');

const getValueForEnv = (env, prodValue = PROD, qaValue = QA) => {
  return typeof env === 'string' && env.toLowerCase() === QA
    ? qaValue
    : prodValue;
};

/**
 * Returns validated environment string
 * @param {string} env
 */
const getEnv = env => getValueForEnv(env);

/**
 * Returns the environment value to place within config
 * NOTE: We do not want to explicitly add PROD to every portalConfig,
 * so this method can be used to only add it if it is already specified
 * @param {string} env
 */
const getEnvForConfig = env => {
  return getValueForEnv(env, '');
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
  getEnv,
  getEnvForConfig,
  getHubSpotWebsiteDomain,
  getHubSpotApiDomain,
};

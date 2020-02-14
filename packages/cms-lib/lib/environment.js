'use es6';
const { ENVIRONMENTS } = require('./constants');

/**
 * Returns validated environment string
 * @param {string} env
 */
const getEnv = env => {
  return typeof env === 'string' && env.toLowerCase() === ENVIRONMENTS.QA
    ? ENVIRONMENTS.QA
    : ENVIRONMENTS.PROD;
};

/**
 * Returns the environment value to place within config
 * NOTE: We do not want to explicitly add PROD to every portalConfig,
 * so this method can be used to only add it if it is already specified
 * @param {string} env
 */
const getEnvForConfig = env => {
  console.log('env: ', env, ENVIRONMENTS);
  return env.toLowerCase() === ENVIRONMENTS.PROD ? '' : ENVIRONMENTS.QA;
};

module.exports = {
  getEnv,
  getEnvForConfig,
};

'use es6';
const { ENVIRONMENTS } = require('./constants');

const getValueForEnv = (
  env,
  prodValue = ENVIRONMENTS.PROD,
  qaValue = ENVIRONMENTS.QA
) => {
  return typeof env === 'string' && env.toLowerCase() === ENVIRONMENTS.QA
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

module.exports = {
  getEnv,
  getEnvForConfig,
};

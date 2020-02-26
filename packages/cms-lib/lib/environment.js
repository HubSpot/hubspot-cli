const { QA, PROD } = require('./constants');

/**
 * Returns valid environment string for QA or Production
 * @param {string} env Environment string, can be any case
 * @param {boolean} maskProd Flag for returning empty string instea of 'prod' -- Can be used to hide env value in the config
 */
const getValidEnv = (env, maskProd = false) => {
  return typeof env === 'string' && env.toLowerCase() === PROD
    ? maskProd
      ? ''
      : PROD
    : QA;
};

module.exports = {
  getValidEnv,
};

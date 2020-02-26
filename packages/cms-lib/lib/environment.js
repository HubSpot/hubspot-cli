const { QA, PROD } = require('./constants');

/**
 * Returns environment constant for QA and PROD or optional masked value for PROD
 * @param {string} env Environment string, can be any case
 * @param {(boolean|object)} shouldMaskProduction Returning alternate value for 'prod' -- Can be used to hide env value in the config
 * @param {any} shouldMaskProduction.maskedValue Alternate value to return in place of 'prod'
 */
const getValidEnv = (env, shouldMaskProduction) => {
  const maskValue =
    typeof shouldMaskProduction === 'object' &&
    Object.prototype.hasOwnProperty.call(shouldMaskProduction, 'maskedValue')
      ? shouldMaskProduction.maskValue
      : '';

  const returnVal =
    typeof env && typeof env === 'string' && env.toLowerCase() === QA
      ? QA
      : shouldMaskProduction
      ? maskValue
      : PROD;

  return returnVal;
};

module.exports = {
  getValidEnv,
};

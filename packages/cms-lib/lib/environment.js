const { ENVIRONMENTS } = require('./constants');

/**
 * Returns environment constant for QA and PROD or optional masked value for PROD
 * @param {string} env Environment string, can be any case
 * @param {(boolean|object)} shouldMaskProduction Returning alternate value for PROD
 *    Can be used to hide env value in the config. Boolean can be used to simply mask 'prod' with ''. The default
 *    is not to modify the returned value for production, and instead return 'prod'.
 * @param {any} shouldMaskProduction.maskedProductionValue Alternate value to return in place of PROD
 */
const getValidEnv = (env, shouldMaskProduction) => {
  const maskValue =
    typeof shouldMaskProduction === 'object' &&
    Object.prototype.hasOwnProperty.call(
      shouldMaskProduction,
      'maskedProductionValue'
    )
      ? shouldMaskProduction.maskedProductionValue
      : '';
  const prodValue = shouldMaskProduction ? maskValue : ENVIRONMENTS.PROD;

  const returnVal =
    typeof env &&
    typeof env === 'string' &&
    env.toLowerCase() === ENVIRONMENTS.QA
      ? ENVIRONMENTS.QA
      : prodValue;

  return returnVal;
};

module.exports = {
  getValidEnv,
};

const { logger } = require('@hubspot/cli-lib/logger');
const { VALIDATION_RESULT } = require('./constants');

function logResultsAsJson(results) {
  let success = true;
  const resultObj = results.reduce((acc, result) => {
    if (!acc[result.validator]) {
      if (success && result.result !== VALIDATION_RESULT.SUCCESS) {
        success = false;
      }
      acc[result.validatorKey] = [];
    }
    const {
      validatorName: __omit1, // eslint-disable-line no-unused-vars
      validatorKey: __omit2, // eslint-disable-line no-unused-vars
      ...resultWithOmittedValues
    } = result;
    acc[result.validatorKey].push(resultWithOmittedValues);
    return acc;
  }, {});
  const result = {
    success,
    results: resultObj,
  };
  return logger.log(JSON.stringify(result));
}

function logValidatorResults(results, { logAsJson = false } = {}) {
  if (logAsJson) {
    return logResultsAsJson(results);
  }
  results.forEach(({ error, validatorName, result }) => {
    const message = `${validatorName}: ${error}`;
    switch (result) {
      case VALIDATION_RESULT.WARNING:
        logger.warn(message);
        break;
      case VALIDATION_RESULT.FATAL:
        logger.error(message);
        break;
      case VALIDATION_RESULT.SUCCESS:
        logger.success(validatorName);
        break;
      default:
        logger.log(message);
    }
  });
  logger.log('\n');
}

module.exports = { logValidatorResults };

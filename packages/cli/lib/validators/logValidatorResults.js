const { logger } = require('@hubspot/cli-lib/logger');
const { VALIDATION_RESULT } = require('./constants');

function logResultsAsJson(results) {
  let success = true;
  const resultObj = results.reduce((acc, result) => {
    if (!acc[result.validator]) {
      if (success && result.result !== VALIDATION_RESULT.SUCCESS) {
        success = false;
      }
      acc[result.validator] = [];
    }
    acc[result.validator].push(result);
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
  results.forEach(({ error, validator, result }) => {
    const message = `${validator}: ${error}`;
    switch (result) {
      case VALIDATION_RESULT.WARNING:
        logger.warn(message);
        break;
      case VALIDATION_RESULT.FATAL:
        logger.error(message);
        break;
      case VALIDATION_RESULT.SUCCESS:
        logger.success(validator);
        break;
      default:
        logger.log(message);
    }
  });
  logger.log('\n');
}

module.exports = { logValidatorResults };

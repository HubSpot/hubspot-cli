const { logger } = require('@hubspot/cli-lib/logger');
const { VALIDATION_RESULT } = require('./constants');

function logResultsAsJson(results) {
  const resultsAsJson = results.reduce((acc, result) => {
    if (!acc[result.validator]) {
      acc[result.validator] = [];
    }
    acc[result.validator].push(result);
    return acc;
  }, {});
  return logger.log(JSON.stringify(resultsAsJson));
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

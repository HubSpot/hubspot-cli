const chalk = require('chalk');
const { logger } = require('@hubspot/cli-lib/logger');
const { VALIDATION_RESULT } = require('./constants');

function logResultsAsJson(groupedResults) {
  let success = true;
  const resultObj = groupedResults.reduce((acc, resultList) => {
    resultList.forEach(result => {
      if (!acc[result.validatorKey]) {
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
    });
    return acc;
  }, {});
  const result = {
    success,
    results: resultObj,
  };
  // Use stdout here b/c console.log will truncate long strings
  process.stdout.write(JSON.stringify(result) + '\n');
}

function logValidatorResults(groupedResults, { logAsJson = false } = {}) {
  if (logAsJson) {
    return logResultsAsJson(groupedResults);
  }
  groupedResults.forEach(results => {
    logger.log(chalk.bold(`${results[0].validatorName} validation results:`));
    logger.group();
    results.forEach(({ error, result }) => {
      switch (result) {
        case VALIDATION_RESULT.WARNING:
          logger.warn(error);
          break;
        case VALIDATION_RESULT.FATAL:
          logger.error(error);
          break;
        case VALIDATION_RESULT.SUCCESS:
          logger.success('No errors');
          break;
        default:
          logger.log(error);
      }
    });
    logger.log('\n');
    logger.groupEnd();
  });
}

module.exports = { logValidatorResults };

const { logger } = require('@hubspot/cli-lib/logger');

const getErrorsFromHublValidationObject = validation =>
  (validation && validation.meta && validation.meta.template_errors) || [];

function printHublValidationError(err) {
  const { severity, message, lineno, startPosition } = err;
  const method = severity === 'FATAL' ? 'error' : 'warn';
  logger[method]('[%d, %d]: %s', lineno, startPosition, message);
}

function printHublValidationResult({ file, validation }) {
  let count = 0;
  const errors = getErrorsFromHublValidationObject(validation);
  if (!errors.length) {
    return count;
  }
  logger.group(file);
  errors.forEach(err => {
    if (err.reason !== 'SYNTAX_ERROR') {
      return;
    }
    ++count;
    printHublValidationError(err);
  });
  logger.groupEnd(file);
  return count;
}

module.exports = {
  printHublValidationResult,
};

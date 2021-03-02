const { logger } = require('@hubspot/cli-lib/logger');
const { ERROR_SEVERITY } = require('./constants');

function logValidatorErrors(errors) {
  logger.log('Validation failed');
  errors.forEach(({ error, validator, severity }) => {
    const message = `${validator}: ${error}`;
    switch (severity) {
      case ERROR_SEVERITY.WARNING:
        logger.warn(message);
        break;
      case ERROR_SEVERITY.FATAL:
        logger.error(message);
        break;
      default:
        logger.log(message);
    }
  });
  logger.log('\n');
}

module.exports = { logValidatorErrors };

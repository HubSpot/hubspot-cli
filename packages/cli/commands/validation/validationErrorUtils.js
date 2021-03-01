const { logger } = require('@hubspot/cli-lib/logger');

//TODO branden I'm sure this should live somewhere else, but not sure where

const WARNING = 'WARNING';
const FATAL = 'FATAL';

const ERROR_SEVERITY = { WARNING, FATAL };

function logValidationErrors(errors) {
  logger.log('Validation failed');
  errors.forEach(({ error, validator, severity }) => {
    const message = `${validator}: ${error}`;
    switch (severity) {
      case WARNING:
        logger.warn(message);
        break;
      case FATAL:
        logger.error(message);
        break;
      default:
        logger.log(message);
    }
  });
  logger.log('\n');
}

module.exports = { ERROR_SEVERITY, logValidationErrors };

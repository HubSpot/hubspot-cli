const { logger } = require('@hubspot/cli-lib/logger');

const WARNING = 'WARNING';
const FATAL = 'FATAL';

const ERROR_SEVERITY = { WARNING, FATAL };

function logValidationErrors(errors) {
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
}

module.exports = { ERROR_SEVERITY, logValidationErrors };

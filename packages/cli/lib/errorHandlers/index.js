const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  isHubSpotHttpError,
  isSystemError,
  isApiUploadValidationError,
  isFileSystemError,
} = require('@hubspot/local-dev-lib/errors/index/index');
const { overrideErrors } = require('./overrideErrors');

function logError(error) {
  logger.debug(error);

  if (overrideErrors(error)) {
    return;
  }

  if (isHubSpotHttpError(error) || isFileSystemError(error)) {
    logger.error(error);
  } else if (isSystemError(error)) {
    logger.error(error.message);
  }
}
module.exports = {
  logError,
};

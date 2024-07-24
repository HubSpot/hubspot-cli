const { debugErrorAndContext, logErrorInstance } = require('./standardErrors');

/**
 * Logs a message for an error instance resulting from filesystem interaction.
 *
 * @param {Error|SystemError|Object} error
 * @param {FileSystemErrorContext}   context
 */
function logFileSystemErrorInstance(error, context) {
  // const fileSystemError = getFileSystemError(error, context);
  logErrorInstance(fileSystemError.message, context);
  debugErrorAndContext(error, context);
}

module.exports = {
  logFileSystemErrorInstance,
};

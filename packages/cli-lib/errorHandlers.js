const {
  ErrorContext,
  isFatalError,
  logErrorInstance,
} = require('./errorHandlers/standardErrors');
const {
  FileSystemErrorContext,
  logFileSystemErrorInstance,
} = require('./errorHandlers/fileSystemErrors');
const {
  ApiErrorContext,
  logApiErrorInstance,
  logApiUploadErrorInstance,
  logApiUploadWarnings,
  logServerlessFunctionApiErrorInstance,
  parseValidationErrors,
} = require('./errorHandlers/apiErrors');

module.exports = {
  ErrorContext,
  ApiErrorContext,
  FileSystemErrorContext,
  isFatalError,
  parseValidationErrors,
  logErrorInstance,
  logApiErrorInstance,
  logApiUploadErrorInstance,
  logApiUploadWarnings,
  logFileSystemErrorInstance,
  logServerlessFunctionApiErrorInstance,
};

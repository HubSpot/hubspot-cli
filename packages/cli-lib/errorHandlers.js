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
  logServerlessFunctionApiErrorInstance,
  parseValidationErrors,
} = require('./errorHandlers/apiErrors');

const { logFieldJsErrors } = require('./errorHandlers/fieldsJsErrors');

module.exports = {
  ErrorContext,
  ApiErrorContext,
  FileSystemErrorContext,
  isFatalError,
  parseValidationErrors,
  logErrorInstance,
  logApiErrorInstance,
  logApiUploadErrorInstance,
  logFileSystemErrorInstance,
  logServerlessFunctionApiErrorInstance,
  logFieldJsErrors,
};

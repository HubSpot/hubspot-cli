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

const {
  FieldErrors,
  logFieldsJsError,
} = require('./errorHandlers/cmsFieldsJsErrors');

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
  FieldErrors,
  logFieldsJsError,
};

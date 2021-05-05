import { isFatalError, logErrorInstance } from './errorHandlers/standardErrors';
import {
  FileSystemErrorContext,
  logFileSystemErrorInstance,
} from './errorHandlers/fileSystemErrors';
import {
  ApiErrorContext,
  logApiErrorInstance,
  logApiUploadErrorInstance,
  logServerlessFunctionApiErrorInstance,
  parseValidationErrors,
} from './errorHandlers/apiErrors';

export default {
  ApiErrorContext,
  FileSystemErrorContext,
  isFatalError,
  parseValidationErrors,
  logErrorInstance,
  logApiErrorInstance,
  logApiUploadErrorInstance,
  logFileSystemErrorInstance,
  logServerlessFunctionApiErrorInstance,
};

import { logger } from '../logger';
import {
  ErrorContext,
  isSystemError,
  debugErrorAndContext,
} from './standardErrors';
import { FileSystemErrorContextInterface, StatusCodeError } from '../types';
class FileSystemErrorContext implements FileSystemErrorContextInterface {
  filepath: string;
  read: boolean;
  write: boolean;

  constructor(
    props: { filepath?: string; read?: boolean; write?: boolean } = {}
  ) {
    this.filepath = props.filepath || '';
    this.read = !!props.read;
    this.write = !!props.write;
  }
}

function logFileSystemErrorInstance(
  error: Error | StatusCodeError,
  context: FileSystemErrorContext
) {
  let fileAction = '';
  if (context.read) {
    fileAction = 'reading from';
  } else if (context.write) {
    fileAction = 'writing to';
  } else {
    fileAction = 'accessing';
  }
  const filepath = context.filepath
    ? `"${context.filepath}"`
    : 'a file or folder';
  const message = [`An error occurred while ${fileAction} ${filepath}.`];
  // Many `fs` errors will be `SystemError`s
  if (isSystemError(error)) {
    message.push(`This is the result of a system error: ${error.message}`);
  }
  logger.error(message.join(' '));
  debugErrorAndContext(error as StatusCodeError, context as ErrorContext);
}

module.exports = {
  FileSystemErrorContext,
  logFileSystemErrorInstance,
};

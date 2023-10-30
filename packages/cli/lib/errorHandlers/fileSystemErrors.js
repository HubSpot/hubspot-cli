const { logger } = require('@hubspot/cli-lib/logger');
const {
  ErrorContext,
  isSystemError,
  debugErrorAndContext,
} = require('./standardErrors');
const { i18n } = require('../lang');

const i18nKey = 'cli.lib.errorHandlers.fileSystemErrors';

class FileSystemErrorContext extends ErrorContext {
  constructor(props = {}) {
    super(props);
    /** @type {string} */
    this.filepath = props.filepath || '';
    /** @type {boolean} */
    this.read = !!props.read;
    /** @type {boolean} */
    this.write = !!props.write;
  }
}

/**
 * Logs a message for an error instance resulting from filesystem interaction.
 *
 * @param {Error|SystemError|Object} error
 * @param {FileSystemErrorContext}   context
 */
function logFileSystemErrorInstance(error, context) {
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
  const message = [i18n(`${i18nKey}.errorOccurred`, { fileAction, filepath })];
  // Many `fs` errors will be `SystemError`s
  if (isSystemError(error)) {
    message.push(
      i18n(`${i18nKey}.errorExplanation`, { errorMessage: error.message })
    );
  }
  logger.error(message.join(' '));
  debugErrorAndContext(error, context);
}

module.exports = {
  FileSystemErrorContext,
  logFileSystemErrorInstance,
};

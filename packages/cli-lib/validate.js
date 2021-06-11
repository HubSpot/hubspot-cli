const fs = require('fs-extra');
const { HUBL_EXTENSIONS } = require('./lib/constants');
const { validateHubl } = require('./api/validate');
const { walk } = require('./lib/walk');
const { logger } = require('./logger');
const { getExt } = require('./path');

/**
 * @async
 * @param {number} accountId
 * @param {string} filepath
 * @param {function} callback - Optional
 * @returns {Promise<Array>}
 * @throws
 */
async function lint(accountId, filepath, callback) {
  const stats = await fs.stat(filepath);
  const files = stats.isDirectory() ? await walk(filepath) : [filepath];
  if (!(files && files.length)) {
    return [];
  }
  return Promise.all(
    files
      .filter(file => HUBL_EXTENSIONS.has(getExt(file)))
      .map(async file => {
        const source = await fs.readFile(file, { encoding: 'utf8' });
        if (!(source && source.trim())) {
          const result = { file, validation: null };
          if (callback) {
            callback(result);
          }
          return result;
        }
        const validation = await validateHubl(accountId, source);
        const result = {
          file,
          validation,
        };
        if (callback) {
          callback(result);
        }
        return result;
      })
  );
}

const getErrorsFromHublValidationObject = validation =>
  (validation && validation.meta && validation.meta.template_errors) || [];

function printHublValidationError(err) {
  const { severity, message, lineno, startPosition } = err;
  const method = severity === 'FATAL' ? 'error' : 'warn';
  logger[method]('[%d, %d]: %s', lineno, startPosition, message);
}

function printHublValidationResult({ file, validation }) {
  let count = 0;
  const errors = getErrorsFromHublValidationObject(validation);
  if (!errors.length) {
    return count;
  }
  logger.group(file);
  errors.forEach(err => {
    if (err.reason !== 'SYNTAX_ERROR') {
      return;
    }
    ++count;
    printHublValidationError(err);
  });
  logger.groupEnd(file);
  return count;
}

module.exports = {
  lint,
  printHublValidationResult,
};

import fs = require('fs-extra');
import { HUBL_EXTENSIONS } from './lib/constants';
import { validateHubl } from './api/validate';
import { walk } from './lib/walk';
import { logger } from './logger';
import { getExt } from './path';

/**
 * @async
 * @param {number} portalId
 * @param {string} filepath
 * @param {function} callback - Optional
 * @returns {Promise<Array>}
 * @throws
 */
export async function lint(portalId, filepath, callback) {
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
        const validation = await validateHubl(portalId, source);
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

export function printHublValidationResult({ file, validation }) {
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

const fsExtra = require('fs-extra');
const path = require('path');
const escapeRegExp = require('./escapeRegExp');
const { logger } = require('../logger');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { getExt, splitLocalPath } = require('../path');
const i18nKey = 'cli.commands.upload';

function handleFieldErrors(e, filePath) {
  if (e instanceof SyntaxError) {
    const ext = getExt(filePath);
    if (ext === 'json') {
      logger.error(
        i18n(`${i18nKey}.errors.jsonParsingFailed`, { json: filePath })
      );
    } else if (ext == 'js') {
      logger.error(i18n(`${i18nKey}.errors.jsSyntaxError`, { js: filePath }));
    }
  }
  if (e.code === 'ENOENT') {
    logger.error(
      i18n(`${i18nKey}.errors.invalidPath`, {
        path: filePath,
      })
    );
  }
  if (e.code === 'MODULE_NOT_FOUND') {
    logger.error(
      i18n(`${i18nKey}.errors.jsSyntaxError`, {
        path: filePath,
      })
    );
  }
}

/*
 * Determines if file is a processable fields.js file (i.e., if it is in the root or in a module folder)
 */
function isProcessableFieldsJs(src, filePath) {
  const regex = new RegExp(`^${escapeRegExp(src)}`);
  const parts = splitLocalPath(filePath);
  const relativePath = filePath.replace(regex, '');
  const baseName = path.basename(filePath);
  const moduleFolder = parts.find(part => part.endsWith('.module'));
  return (
    baseName == 'fields.js' && (moduleFolder || relativePath == '/fields.js')
  );
}

/**
 * Converts a fields.js file into a fields.json file, writes, and returns of fields.json
 * @param {string} file - The path of the fields.js javascript file.
 * @param {string[]} options - Optional arguments to pass to the exported function in fields.js
 * @param {string} writeDir - The path to write the file to.
 * @returns {string} The path of the written fields.json file.
 */
async function convertFieldsJs(filePath, options, writeDir) {
  const dirName = path.dirname(filePath);
  logger.info(
    i18n(`${i18nKey}.converting`, {
      src: dirName + '/fields.js',
      dest: dirName + '/fields.json',
    })
  );

  try {
    /* Since we require() fields.js files, node will cache them.
     * Thus during an hs watch, if the user edits a fields.js file, node will return the cached version on require() instead of re-requiring the new one.
     * So we clean the cache before requiring so that node requires the fresh fields.js. See https://nodejs.org/api/modules.html#caching.
     */
    delete require.cache[filePath];

    // If no options are provided, yargs will pass [''].
    return Promise.resolve(await require(filePath)(options)).then(fields => {
      if (!Array.isArray(fields)) {
        throw new SyntaxError(`${filePath} does not return an array.`);
      }

      let finalPath = path.join(writeDir, '/fields.json');
      let json = fieldsArrayToJson(fields);
      try {
        fsExtra.outputFileSync(finalPath, json);
      } catch (e) {
        handleFieldErrors(e, filePath);
        throw e;
      }
      logger.info(
        i18n(`${i18nKey}.converted`, {
          src: dirName + '/fields.js',
          dest: dirName + '/fields.json',
        })
      );
      return finalPath;
    });
  } catch (e) {
    handleFieldErrors(e, filePath);
    throw e;
  }
}

function fieldsArrayToJson(fields) {
  //Transform fields array to JSON
  fields = fields.flat(Infinity).map(field => {
    return typeof field['toJSON'] === 'function' ? field.toJSON() : field;
  });
  return JSON.stringify(fields);
}

module.exports = {
  fieldsArrayToJson,
  convertFieldsJs,
  handleFieldErrors,
  isProcessableFieldsJs,
};

const fs = require('fs');
const path = require('path');
const { logger } = require('../logger');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { getExt } = require('../path');
const i18nKey = 'cli.commands.upload';
const { getCwd } = require('@hubspot/cli-lib/path');

const fileResolver = {
  apply: (target, _, args) => {
    let filePath = args.shift();

    // Get the path to the folder containing the fields.js file through a stack trace so we can resolve relative paths.
    const line = new Error().stack.split('\n')[2];
    const callerPath = line.slice(
      line.lastIndexOf('(') + 1,
      line.lastIndexOf('/') + 1
    );
    const absoluteSrcPath = path.resolve(getCwd(), callerPath, filePath);
    return target(absoluteSrcPath, ...args);
  },
};

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

/**
 * Converts a fields.js file into a fields.json file, writes, and returns of fields.json
 * @param {string} file - The path of the fields.js javascript file.
 * @param {string[]} options - Optional arguments to pass to the exported function in fields.js
 * @returns {string} The path of the written fields.json file.
 */
function convertFieldsJs(filePath, options) {
  const dirName = path.dirname(filePath);
  logger.info(
    i18n(`${i18nKey}.converting`, {
      src: dirName + '/fields.js',
      dest: dirName + '/fields.json',
    })
  );

  let fields;
  try {
    // If we do not clear the cache, hs watch will not work
    delete require.cache[filePath];

    // If no options are provided, yargs will pass [''].
    fields = require(filePath)(options);
  } catch (e) {
    handleFieldErrors(e, filePath);
    throw e;
  }

  if (!Array.isArray(fields)) {
    throw new SyntaxError(`${filePath} does not return an array.`);
  }

  let finalPath = path.dirname(filePath) + '/fields.json';
  let json = fieldsArrayToJson(fields);
  try {
    fs.writeFileSync(finalPath, json);
  } catch (e) {
    handleFieldErrors(e, filePath);
    throw e;
  }
  return finalPath;
}

function jsonLoader(filePath) {
  const file = fs.readFileSync(filePath);
  let json = JSON.parse(file);
  return json;
}

function partialLoader(filePath, partial) {
  let json = {};
  try {
    json = JSON.parse(fs.readFileSync(filePath));
  } catch (e) {
    handleFieldErrors(e, filePath);
    throw e;
  }
  if (partial in json) {
    return json[partial];
  } else {
    logger.error(
      i18n(`${i18nKey}.errors.jsonPartiaNotFound`, {
        partial: partial,
        src: filePath,
      })
    );
    // Just move on if no partial is found.
    return {};
  }
}

function fieldsArrayToJson(fields) {
  //Transform fields array to JSON
  fields = fields.flat(Infinity).map(field => {
    return typeof field['toJSON'] === 'function' ? field.toJSON() : field;
  });
  return JSON.stringify(fields);
}

const loadJson = new Proxy(jsonLoader, fileResolver);
const loadPartial = new Proxy(partialLoader, fileResolver);

module.exports = {
  fieldsArrayToJson,
  loadJson,
  loadPartial,
  convertFieldsJs,
  handleFieldErrors,
};

const fs = require('fs');
const path = require('path');
const { logger } = require('../logger');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { getExt } = require('../path');
const i18nKey = 'cli.commands.upload';
const { getCwd } = require('@hubspot/cli-lib/path');
const fileResolver = {
  apply: (target, thisArg, args) => {
    let filePath = args.shift();

    // Get the path to the folder containing the fields.js file through a stack trace so we can resolve relative paths.
    const line = new Error().stack.split('\n')[2];
    const callerPath = line.slice(
      line.lastIndexOf('(') + 1,
      line.lastIndexOf('/') + 1
    );
    const absoluteSrcPath = path.resolve(getCwd(), callerPath, filePath);
    console.log(args);
    return target(absoluteSrcPath, ...args);
  },
};

function handleFieldErrors(e, file) {
  if (e instanceof SyntaxError) {
    const ext = getExt(file);
    if (ext === 'json') {
      logger.error(i18n(`${i18nKey}.errors.jsonParsingFailed`, { json: file }));
    } else if (ext == 'js') {
      logger.error(i18n(`${i18nKey}.errors.jsSyntaxError`, { js: file }));
    }
  }
  if (e.code === 'ENOENT') {
    logger.error(
      i18n(`${i18nKey}.errors.invalidPath`, {
        path: file,
      })
    );
  }
  logger.error(e);
}

/**
 * Converts a fields.js file into a fields.json file, writes, and returns of fields.json
 * @param {string} file - The path of the fields.js javascript file.
 * @param {string[]} options - Optional arguments to pass to the exported function in fields.js
 * @returns {string} The path of the written fields.json file.
 */
function convertFieldsJs(filePath, options) {
  // If no options are provided, yargs will pass [''].
  let fields = require(filePath)(options);
  let finalPath = path.dirname(filePath) + '/fields.json';
  let json = fieldsArrayToJson(fields);
  fs.writeFileSync(finalPath, json);
  return finalPath;
}

function fieldToJson(field) {
  // If the object has a toJson function, then run it and return the output.
  if (typeof field['toJSON'] === 'function') {
    return field.toJSON();
  }
  return field;
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
  if (Array.isArray(fields)) {
    fields = fields.flat(Infinity).map(field => fieldToJson(field));
    return JSON.stringify(fields);
  }
  //Not an array... bad
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

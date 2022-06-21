const fs = require('fs');
const path = require('path');
const { logger } = require('../logger');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { getExt } = require('../path');
const i18nKey = 'cli.commands.upload';

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
function convertFieldsJs(file, options) {
  let fields = require(file)(options);
  let finalPath = path.dirname(file) + '/fields.json';

  let json = fieldsArrayToJson(fields);
  fs.writeFileSync(finalPath, json);
  return finalPath;
}

function fieldToJson(field) {
  if (typeof field['toJSON'] === 'function') {
    return field.toJSON();
  }
  return field;
}

function loadJson(file) {
  // We would do validation etc. here, but for now just load the file
  let json = JSON.parse(fs.readFileSync(path.resolve(file)));
  return json;
}

function loadPartial(file, partial) {
  let json = {};
  try {
    json = JSON.parse(fs.readFileSync(file));
  } catch (e) {
    handleFieldErrors(e, file);
    throw e;
  }
  if (partial in json) {
    return json[partial];
  } else {
    logger.error(
      i18n(`${i18nKey}.errors.jsonPartiaNotFound`, {
        partial: partial,
        src: file,
      })
    );
  }
  return {};
}

function fieldsArrayToJson(fields) {
  //Transform fields array to JSON
  fields = fields.flat(Infinity).map(field => fieldToJson(field));

  return JSON.stringify(fields);
}

module.exports = {
  fieldsArrayToJson,
  loadJson,
  loadPartial,
  convertFieldsJs,
  handleFieldErrors,
};

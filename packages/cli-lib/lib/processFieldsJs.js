const process = require('process');
const path = require('path');
const fs = require('fs');
const semver = require('semver');
const { pathToFileURL } = require('url');
const { getExt } = require('../path');
const { logger, setLogLevel } = require('../logger');
const { FieldErrors, logFieldsJsError } = require('../errorHandlers');
const { i18n } = require('./lang');

const i18nKey = 'cli.commands.upload';

const { dirName, fieldOptions, filePath, writeDir, logLevel } = process.env;
const baseName = path.basename(filePath);

// We need to carry over the log level from the parent instance
setLogLevel(Number(logLevel));

const logError = (err, info = {}) => logFieldsJsError(err, filePath, info);
const errorCatch = e => {
  logError(e);
  // Errors caught by this could be caused by the users javascript, so just print the whole error for them.
  logger.error(e);
};

logger.info(
  i18n(`${i18nKey}.converting`, {
    src: dirName + `/${baseName}`,
    dest: dirName + '/fields.json',
  })
);

/*
 * How this works: dynamicImport() will always return either a Promise or undefined.
 * In the case when it's a Promise, its expected that it will resolve to a function.
 * This function has optional return type of Promise<Array> | Array. In order to have uniform handling,
 * we wrap the return value of the function in a Promise.resolve(), and then process.
 */

const fieldsPromise = dynamicImport(filePath).catch(e => errorCatch(e));

fieldsPromise.then(fieldsFunc => {
  const fieldsFuncType = typeof fieldsFunc;
  if (fieldsFuncType !== 'function') {
    logError(FieldErrors.IsNotFunction, {
      returned: fieldsFuncType,
    });
    return;
  }
  return Promise.resolve(fieldsFunc(fieldOptions)).then(fields => {
    if (!Array.isArray(fields)) {
      logError(FieldErrors.DoesNotReturnArray, {
        returned: typeof fields,
      });
      return;
    }

    const finalPath = path.join(writeDir, '/fields.json');

    return fieldsArrayToJson(fields).then(json => {
      if (!fs.existsSync(writeDir)) {
        fs.mkdirSync(writeDir, { recursive: true });
      }
      fs.writeFileSync(finalPath, json);

      logger.success(
        i18n(`${i18nKey}.converted`, {
          src: dirName + `/${baseName}`,
          dest: dirName + '/fields.json',
        })
      );
      process.send({
        action: 'COMPLETE',
        finalPath,
      });
    });
  });
});

/*
 * Polyfill for `Array.flat(Infinity)` since the `flat` is only available for Node v11+
 * https://stackoverflow.com/a/15030117
 */
function flattenArray(arr) {
  return arr.reduce((flat, toFlatten) => {
    return flat.concat(
      Array.isArray(toFlatten) ? flattenArray(toFlatten) : toFlatten
    );
  }, []);
}

/**
 * Converts an array of field objects to JSON
 * @param {array} fields - Array of field objects
 * @returns {string} - Returns converted JSON
 */
async function fieldsArrayToJson(fields) {
  fields = await Promise.all(flattenArray(fields));
  fields = fields.map(field => {
    return typeof field['toJSON'] === 'function' ? field.toJSON() : field;
  });
  return JSON.stringify(fields, null, 2);
}

/**
 * Takes in a path to a javascript file and either dynamically imports it or requires it, and returns, depending on node version.
 * @param {string} filePath - Path to javascript file
 * @returns {Promise | undefined} - Returns _default_ exported content if ESM, or exported module content if CJS, or undefined if node version < 13.2 and file is .mjs.
 */
async function dynamicImport(filePath) {
  if (semver.gte(process.version, '13.2.0')) {
    const exported = await import(pathToFileURL(filePath)).then(
      content => content.default
    );
    return exported;
  } else {
    if (getExt(filePath) == 'mjs') {
      logger.error('.mjs files are only supported when using Node 13.2.0+');
      return undefined;
    }
    return require(filePath);
  }
}

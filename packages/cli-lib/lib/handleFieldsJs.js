const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const escapeRegExp = require('./escapeRegExp');
const { dynamicImport } = require('./dynamicImport');
const { isModuleFolderChild } = require('../modules');
const { logger } = require('../logger');
const { getCwd } = require('../path');
const { i18n } = require('./lang');
const { FieldErrors, logFieldsJsError } = require('../errorHandlers');
const i18nKey = 'cli.commands.upload';

/**
 * FieldsJS Class.
 * @param {string} projectDir - The root directory of the filePath
 * @param {string} filePath - The path to the fields.js file to be converted
 * @param {string} [rootWriteDir] - (Optional) The root of the directory in which to output the fields.js. If blank, a temporary directory is created.
 */
class FieldsJs {
  constructor(projectDir, filePath, rootWriteDir, fieldOptions = ['']) {
    this.projectDir = projectDir;
    this.filePath = filePath;
    this.fieldOptions = fieldOptions;
    this.rejected = false;
    // Create tmpDir if no writeDir is given.
    this.rootWriteDir =
      rootWriteDir === undefined
        ? createTmpDirSync('hubspot-temp-fieldsjs-output-')
        : rootWriteDir;
  }

  async init() {
    const outputPath = await this.getOutputPathPromise();
    this.outputPath = this.rejected ? undefined : outputPath;
    return this;
  }

  /**
   * Converts a fields.js file into a fields.json file, writes, and returns of fields.json
   * @param {string} file - The path of the fields.js javascript file.
   * @param {string} writeDir - The directory to write the file to.
   * @returns {Promise} finalPath - Promise that returns path of the written fields.json file.
   */
  convertFieldsJs(writeDir) {
    const filePath = this.filePath;
    const baseName = path.basename(filePath);
    const dirName = path.dirname(filePath);
    const cwd = getCwd();
    const logError = (err, info = {}) => logFieldsJsError(err, filePath, info);
    const errorCatch = e => {
      this.rejected = true;
      process.chdir(cwd);
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

    try {
      // Switch CWD to the dir of the fieldsjs. This is so that any calls to the file system that are written relatively will resolve properly.
      process.chdir(dirName);

      /*
       * How this works: dynamicImport() will always return either a Promise or undefined.
       * In the case when it's a Promise, its expected that it will resolve to a function.
       * This function has optional return type of Promise<Array> | Array. In order to have uniform handling,
       * we wrap the return value of the function in a Promise.resolve(), and then process.
       */

      const fieldsPromise = dynamicImport(filePath).catch(e => errorCatch(e));

      return fieldsPromise.then(fieldsFunc => {
        const fieldsFuncType = typeof fieldsFunc;
        if (fieldsFuncType !== 'function') {
          this.rejected = true;
          logError(FieldErrors.IsNotFunction, {
            returned: fieldsFuncType,
          });
          return;
        }
        return Promise.resolve(fieldsFunc(this.fieldOptions)).then(fields => {
          if (!Array.isArray(fields)) {
            this.rejected = true;
            logError(FieldErrors.DoesNotReturnArray, {
              returned: typeof fields,
            });
            return;
          }
          const finalPath = path.join(writeDir, '/fields.json');
          const json = fieldsArrayToJson(fields);
          fs.outputFileSync(finalPath, json);
          logger.success(
            i18n(`${i18nKey}.converted`, {
              src: dirName + `/${baseName}`,
              dest: dirName + '/fields.json',
            })
          );
          // Switch back to the original directory.
          process.chdir(cwd);
          return finalPath;
        });
      });
    } catch (e) {
      errorCatch(e);
    }
  }

  /**
   * If there has been a fields.json written to the output path, then copy it from the output
   * directory to the project directory, respecting the path within the output directory.
   * Ex: path/to/tmp/example.module/fields.json => path/to/project/example.module/fields.output.json
   */
  saveOutput() {
    if (!fs.existsSync(this.outputPath)) {
      logger.error(
        `There was an error saving the json output of ${this.filePath}`
      );
      return;
    }
    const relativePath = path.relative(
      this.rootWriteDir,
      path.dirname(this.outputPath)
    );
    const savePath = path.join(
      this.projectDir,
      relativePath,
      'fields.output.json'
    );
    try {
      fs.copyFileSync(this.outputPath, savePath);
    } catch (err) {
      logger.error(`There was an error saving the json output to ${savePath}`);
    }
  }

  /**
   * Resolves the relative path to the fields.js within the project directory and returns
   * directory name to write to in rootWriteDir directory.
   *
   * Ex: If rootWriteDir = 'path/to/temp', filePath = 'projectRoot/sample.module/fields.js'. Then getWriteDir() => path/to/temp/sample.module
   */
  getWriteDir() {
    const projectDirRegex = new RegExp(`^${escapeRegExp(this.projectDir)}`);
    const relativePath = this.filePath.replace(projectDirRegex, '');
    return path.dirname(path.join(this.rootWriteDir, relativePath));
  }

  /**
   * @returns {Promise} Promise that resolves to the path of the output fields.json
   */
  getOutputPathPromise() {
    const writeDir = this.getWriteDir();
    return this.convertFieldsJs(writeDir).then(outputPath => outputPath);
  }
}

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

//Transform fields array to JSON
function fieldsArrayToJson(fields) {
  fields = flattenArray(fields).map(field => {
    return typeof field['toJSON'] === 'function' ? field.toJSON() : field;
  });
  return JSON.stringify(fields, null, 2);
}

/**
 * Determines if file is a processable fields.js file i.e., if it is called
 * 'fields.js' and in a root or in a module folder, and if processFieldsJs flag is true.
 * @param {string} rootDir - The root directory of the project where the file is
 * @param {string} filePath - The file to check
 * @param {Boolean} processFieldsJs - The processFields flag option value
 */
function isProcessableFieldsJs(rootDir, filePath, processFieldsJs = false) {
  const allowedFieldsNames = ['fields.js', 'fields.mjs', 'fields.cjs'];
  const regex = new RegExp(`^${escapeRegExp(rootDir)}`);
  const relativePath = path.dirname(filePath.replace(regex, ''));
  const baseName = path.basename(filePath);
  const inModuleFolder = isModuleFolderChild({ path: filePath, isLocal: true });
  return !!(
    processFieldsJs &&
    allowedFieldsNames.includes(baseName) &&
    (inModuleFolder || relativePath == '/')
  );
}

/**
 * Try cleaning up resources from os's tempdir
 * @param {String} prefix - Prefix for directory name.
 */
function createTmpDirSync(prefix) {
  let tmpDir;
  try {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  } catch (err) {
    logger.error('An error occured writing temporary project source.');
    throw err;
  }
  return tmpDir;
}

/**
 * Try cleaning up resources from os's tempdir
 * @param {String} tmpDir
 */
function cleanupTmpDirSync(tmpDir) {
  fs.rm(tmpDir, { recursive: true }, err => {
    if (err) {
      logger.error('There was an error deleting the temporary project source');
    }
  });
}
module.exports = {
  FieldsJs,
  fieldsArrayToJson,
  isProcessableFieldsJs,
  createTmpDirSync,
  cleanupTmpDirSync,
};

const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const escapeRegExp = require('./escapeRegExp');
const { isModuleFolderChild } = require('../modules');
const { logger } = require('../logger');
const { getCwd, getExt } = require('@hubspot/cli-lib/path');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
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

  /**
   * Converts a fields.js file into a fields.json file, writes, and returns of fields.json
   * @param {string} file - The path of the fields.js javascript file.
   * @param {string} writeDir - The directory to write the file to.
   * @returns {Promise} finalPath - Promise that returns path of the written fields.json file.
   */
  convertFieldsJs(writeDir) {
    const filePath = this.filePath;
    const dirName = path.dirname(filePath);
    const cwd = getCwd();
    console.log(cwd, dirName);
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

      // Switch CWD to the dir of the fieldsjs. This is so that any calls to the file system that are written relatively will resolve properly.
      process.chdir(dirName);
      /*
       * If the dev marks their exported function as async, then require(filePath) returns an async function. In that case, fieldsArray is going to be a Promise.
       * Further, it is expected that devs use await on any asyncronous calls.
       * But fieldsArray _might_ not be a Promise. In order to be sure that it is, we use Promise.resolve.
       */
      const fieldsArray = require(filePath)(this.fieldOptions);
      return Promise.resolve(fieldsArray)
        .then(fields => {
          if (!Array.isArray(fields)) {
            throw new SyntaxError(`${filePath} does not return an array.`);
          }

          const finalPath = path.join(writeDir, '/fields.json');
          const json = fieldsArrayToJson(fields);
          fs.outputFileSync(finalPath, json);
          logger.success(
            i18n(`${i18nKey}.converted`, {
              src: dirName + '/fields.js',
              dest: dirName + '/fields.json',
            })
          );
          // Switch back to the original directory.
          process.chdir(cwd);
          return finalPath;
        })
        .catch(e => {
          process.chdir(cwd);
          // Errors caught by this could be caused by the users field.js, so just print the whole error for them.
          logger.error(e);
        });
    } catch (e) {
      process.chdir(cwd);
      this.rejected = true;
      logFieldsJsErrors(e, filePath);
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
      throw err;
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

//Transform fields array to JSON
function fieldsArrayToJson(fields) {
  fields = fields.flat(Infinity).map(field => {
    return typeof field['toJSON'] === 'function' ? field.toJSON() : field;
  });
  return JSON.stringify(fields);
}

/**
 * Determines if file is a processable fields.js file (i.e., if it is called 'fields.js' and in a root or in a module folder)
 */
function isProcessableFieldsJs(rootDir, filePath) {
  const regex = new RegExp(`^${escapeRegExp(rootDir)}`);
  const relativePath = filePath.replace(regex, '');
  const baseName = path.basename(filePath);
  const inModuleFolder = isModuleFolderChild({ path: filePath, isLocal: true });
  return (
    baseName == 'fields.js' && (inModuleFolder || relativePath == '/fields.js')
  );
}

function logFieldsJsErrors(e, filePath) {
  if (e instanceof SyntaxError) {
    const ext = getExt(filePath);
    if (ext == 'js') {
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
      throw err;
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

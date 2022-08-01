const fs = require('fs');
const os = require('os');
const path = require('path');
const fsExtra = require('fs-extra');
const escapeRegExp = require('./escapeRegExp');
const yargs = require('yargs');
const { logger } = require('../logger');
const { getCwd } = require('@hubspot/cli-lib/path');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { getExt, splitLocalPath } = require('../path');
const i18nKey = 'cli.commands.upload';

class FieldsJs {
  constructor(src, filePath, rootWriteDir) {
    this.src = src;
    this.filePath = filePath;

    // Create tmpDir if no writeDir is given.
    this.rootWriteDir =
      rootWriteDir === undefined ? FieldsJs.createTmpDir() : rootWriteDir;
  }

  static createTmpDir() {
    let tmpDir;
    try {
      tmpDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'hubspot-temp-fieldsjs-output-')
      );
    } catch (err) {
      logger.error('An error occured writing temporary project source.');
      throw err;
    }
    return tmpDir;
  }

  // Accepts either a path as a string, or a FieldsJs object with a rootWriteDir property.
  static deleteDir(dir) {
    fs.rm(dir, { recursive: true }, err => {
      if (err) {
        logger.error(
          'There was an error deleting the temporary project source'
        );
        throw err;
      }
    });
  }

  saveOutput() {
    // Save in same directory as respective fields.js.
    const relativePath = path.relative(
      this.rootWriteDir,
      path.dirname(this.outputPath)
    );
    const savePath = path.join(this.src, relativePath, 'fields.output.json');
    try {
      fs.copyFileSync(this.outputPath, savePath);
    } catch (err) {
      logger.error(`There was an error saving the json output to ${savePath}`);
      throw err;
    }
  }

  getWriteDir() {
    const srcDirRegex = new RegExp(`^${escapeRegExp(this.src)}`);
    const relativePath = this.filePath.replace(srcDirRegex, '');
    return path.dirname(path.join(this.rootWriteDir, relativePath));
  }

  // Returns a promise that resolves to the output path of the fields.js file.
  getOutputPathPromise() {
    const writeDir = this.getWriteDir();
    return convertFieldsJs(this.filePath, writeDir).then(
      outputPath => outputPath
    );
  }
}

/**
 * Converts a fields.js file into a fields.json file, writes, and returns of fields.json
 * @param {string} file - The path of the fields.js javascript file.
 * @param {string} writeDir - The directory to write the file to.
 * @returns {Promise} finalPath - Promise that returns path of the written fields.json file.
 */
function convertFieldsJs(filePath, writeDir) {
  const options = yargs.argv.options;
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

    // Save CWD and then switch CWD to the project. This is so that any calls to the file system that are written relatively will resolve properly.
    const cwd = getCwd();
    process.chdir(dirName);

    /*
     * If the dev marks their exported function as async, then require(filePath) returns an async function. In that case, fieldsArray is going to be a Promise.
     * Further, it is expected that devs use await on any asyncronous calls.
     * But fieldsArray _might_ not be a Promise. In order to be sure that it is, we use Promise.resolve.
     */
    const fieldsArray = require(filePath)(options);
    return Promise.resolve(fieldsArray).then(fields => {
      if (!Array.isArray(fields)) {
        throw new SyntaxError(`${filePath} does not return an array.`);
      }

      let finalPath = path.join(writeDir, '/fields.json');
      let json = fieldsArrayToJson(fields);
      fsExtra.outputFileSync(finalPath, json);
      logger.info(
        i18n(`${i18nKey}.converted`, {
          src: dirName + '/fields.js',
          dest: dirName + '/fields.json',
        })
      );
      // Switch back to the original directory.
      process.chdir(cwd);
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

function handleFieldErrors(e, filePath) {
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

/*
 * Determines if file is a processable fields.js file (i.e., if it is called 'fields.js' and in a root or in a module folder)
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

module.exports = {
  FieldsJs,
  fieldsArrayToJson,
  convertFieldsJs,
  handleFieldErrors,
  isProcessableFieldsJs,
};

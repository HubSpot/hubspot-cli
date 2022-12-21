const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { fork } = require('child_process');
const escapeRegExp = require('./escapeRegExp');
const { isModuleFolderChild } = require('../modules');
const { logger, getLogLevel } = require('../logger');

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
    const dirName = path.dirname(filePath);

    return new Promise((resolve, reject) => {
      const convertFieldsProcess = fork(
        path.join(__dirname, './processFieldsJs.js'),
        [],
        {
          cwd: dirName,
          env: {
            dirName,
            fieldOptions: this.fieldOptions,
            filePath,
            writeDir,
            logLevel: getLogLevel(),
          },
        }
      );
      logger.debug(
        `Creating child process with pid ${convertFieldsProcess.pid}`
      );
      convertFieldsProcess.on('message', function(message) {
        if (message.action === 'ERROR') {
          reject(logger.error(message.message));
        } else if (message.action === 'COMPLETE') {
          resolve(message.finalPath);
        }
      });

      convertFieldsProcess.on('close', () => {
        logger.debug(
          `Child process with pid ${convertFieldsProcess.pid} has been terminated`
        );
      });
    }).catch(e => {
      logger.error(`There was an error converting '${filePath}'`);
      logger.error(e);
    });
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
async function fieldsArrayToJson(fields) {
  fields = await Promise.all(flattenArray(fields));
  fields = fields.map(field => {
    return typeof field['toJSON'] === 'function' ? field.toJSON() : field;
  });
  return JSON.stringify(fields, null, 2);
}

/**
 * Determines if file is a convertable fields.js file i.e., if it is called
 * 'fields.js' and in a root or in a module folder, and if convertFields flag is true.
 * @param {string} rootDir - The root directory of the project where the file is
 * @param {string} filePath - The file to check
 * @param {Boolean} convertFields - The convertFields flag option value
 */
function isConvertableFieldJs(rootDir, filePath, convertFields = false) {
  const allowedFieldsNames = ['fields.js', 'fields.mjs', 'fields.cjs'];
  const regex = new RegExp(`^${escapeRegExp(rootDir)}`);
  const relativePath = path.dirname(filePath.replace(regex, ''));
  const baseName = path.basename(filePath);
  const inModuleFolder = isModuleFolderChild({ path: filePath, isLocal: true });
  return !!(
    convertFields &&
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
  isConvertableFieldJs,
  createTmpDirSync,
  cleanupTmpDirSync,
};

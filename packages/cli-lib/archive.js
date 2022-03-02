const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { promisify } = require('util');

const extract = promisify(require('extract-zip'));

const { logger } = require('./logger');
const {
  logFileSystemErrorInstance,
  logErrorInstance,
} = require('./errorHandlers');

/**
 * @param {String} name - Name of zipped asset
 * @param {Buffer} zip
 * @returns {String|Null} Temp dir where zip has been extracted.
 */
async function extractZip(name, zip) {
  const TMP_FOLDER_PREFIX = `hubspot-${name}-`;

  logger.log('Extracting project source...');
  // Write zip to disk
  let tmpDir;
  let tmpZipPath;
  try {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), TMP_FOLDER_PREFIX));
    tmpZipPath = path.join(tmpDir, 'hubspot-temp.zip');
    await fs.ensureFile(tmpZipPath);
    await fs.writeFile(tmpZipPath, zip, {
      mode: 0o777,
    });
  } catch (err) {
    logger.error('An error occured writing temp project source.');
    if (tmpZipPath || tmpDir) {
      logFileSystemErrorInstance(err, {
        filepath: tmpZipPath || tmpDir,
        write: true,
      });
    } else {
      logErrorInstance(err);
    }
    return null;
  }
  // Extract zip
  let extractDir = null;
  try {
    const tmpExtractPath = path.join(tmpDir, 'extracted');
    await extract(tmpZipPath, { dir: tmpExtractPath });
    extractDir = tmpExtractPath;
  } catch (err) {
    logger.error('An error occured extracting project source.');
    logErrorInstance(err);
    return null;
  }
  logger.debug('Completed project source extraction.');
  return { extractDir, tmpDir };
}

/**
 * @param {String} src - Dir where boilerplate repo files have been extracted.
 * @param {String} sourceDir - Directory in project that should get copied.
 * @param {String} dest - Dir to copy boilerplate src files to.
 * @returns {Boolean} `true` if successfully copied, `false` otherwise.
 */
async function copySourceToDest(src, dest, sourceDir) {
  try {
    logger.log('Copying project source...');
    const files = await fs.readdir(src);
    const rootDir = files[0];
    const projectSrcDir = path.join(src, rootDir, sourceDir);
    await fs.copy(projectSrcDir, dest);
    logger.debug('Completed copying project source.');
    return true;
  } catch (err) {
    logger.error(`An error occured copying project source to ${dest}.`);
    logFileSystemErrorInstance(err, {
      filepath: dest,
      write: true,
    });
  }
  return false;
}

/**
 * Try cleaning up resources from os's tempdir
 * @param {String} tmpDir
 */
function cleanupTempDir(tmpDir) {
  if (!tmpDir) return;
  try {
    fs.remove(tmpDir);
  } catch (e) {
    // noop
  }
}

async function extractZipArchive(zip, name, dest, { sourceDir } = {}) {
  let success = false;

  if (zip) {
    const { extractDir, tmpDir } = (await extractZip(name, zip)) || {};

    if (extractDir !== null) {
      success = await copySourceToDest(extractDir, dest, sourceDir);
    }

    cleanupTempDir(tmpDir);
  }
  return success;
}

module.exports = {
  extractZipArchive,
};

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { promisify } = require('util');

const request = require('request-promise-native');
const extract = promisify(require('extract-zip'));

const { logger } = require('./logger');
const {
  logFileSystemErrorInstance,
  logErrorInstance,
} = require('./errorHandlers');

// TODO: When the boilerplate project cuts a release, use latest instead.
// https://help.github.com/en/github/administering-a-repository/linking-to-releases#linking-to-the-latest-release
const THEME_BOILERPLATE_ZIP_URI =
  'https://github.com/HubSpot/cms-theme-boilerplate/archive/master.zip';
const ZIP_CONTENT_TYPE = 'application/zip';
const TMP_BOILERPLATE_FOLDER_PREFIX = 'hubspot-cms-theme-boilerplate-';

/**
 * @returns {Buffer} Zip data buffer
 */
async function downloadCmsThemeBoilerplate() {
  try {
    logger.log('Fetching theme...');
    const zip = await request.get(THEME_BOILERPLATE_ZIP_URI, {
      encoding: null,
      headers: {
        'content-type': ZIP_CONTENT_TYPE,
        accept: ZIP_CONTENT_TYPE,
      },
    });
    logger.log('Completed theme fetch.');
    return zip;
  } catch (err) {
    logger.error('An error occured fetching the theme source.');
    logErrorInstance(err);
  }
}

/**
 * @param {Buffer} zip
 * @returns {String|Null} Temp dir where zip has been extracted.
 */
async function extractThemeZip(zip) {
  logger.log('Extracting theme source...');
  // Write zip to disk
  let tmpFolder;
  let tmpZipPath;
  try {
    tmpFolder = fs.mkdtempSync(
      path.join(os.tmpdir(), TMP_BOILERPLATE_FOLDER_PREFIX)
    );
    tmpZipPath = path.join(tmpFolder, 'boilerplate.zip');
    await fs.ensureFile(tmpZipPath);
    await fs.writeFile(tmpZipPath, zip, {
      mode: 0o777,
    });
  } catch (err) {
    logger.error('An error occured writing temp theme source.');
    if (tmpFolder) {
      logFileSystemErrorInstance(err, {
        filepath: tmpFolder,
        write: true,
      });
    } else {
      logErrorInstance(err);
    }
    return null;
  }
  // Extract zip
  let extractPath = null;
  try {
    const tmpExtractPath = path.join(tmpFolder, 'extracted');
    await extract(tmpZipPath, { dir: tmpExtractPath });
    extractPath = tmpExtractPath;
  } catch (err) {
    logger.error('An error occured extracting theme source.');
    logErrorInstance(err);
  }
  logger.log('Completed theme source extraction.');
  return extractPath;
}

/**
 * @param {String} src - Dir where boilerplate repo files have been extracted.
 * @param {String} dest - Dir to copy boilerplate src files to.
 * @returns {Boolean} `true` if successfully copied, `false` otherwise.
 */
async function copyThemeBoilerplateToDest(src, dest) {
  try {
    logger.log('Copying theme source to "%s"', dest);
    const files = await fs.readdir(src);
    const rootDir = files[0];
    const themeSrcDir = path.join(src, rootDir, 'src');
    await fs.copy(themeSrcDir, dest);
    logger.log('Completed copying theme source.');
    return true;
  } catch (err) {
    logger.error(`An error occured copying theme source to "${dest}".`);
    logFileSystemErrorInstance(err, {
      filepath: dest,
      write: true,
    });
  }
  return false;
}

/**
 * Writes a copy of the boilerplate theme to dest.
 * @param {String} dest - Dir top write theme src to.
 * @returns {Boolean} `true` if successful, `false` otherwise.
 */
async function createTheme(dest) {
  const zip = await downloadCmsThemeBoilerplate();
  if (!zip) return false;
  const extractFolder = await extractThemeZip(zip);
  if (!extractFolder) return false;
  return copyThemeBoilerplateToDest(extractFolder, dest);
}

module.exports = {
  createTheme,
};

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { promisify } = require('util');

const request = require('request-promise-native');
const extract = promisify(require('extract-zip'));

const { logger } = require('./logger');
// const { getCwd } = require('./path');
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
 * @returns {Buffer|Null} Zip data buffer
 */
async function downloadCmsThemeBoilerplate() {
  let zip = null;
  try {
    zip = await request.get(THEME_BOILERPLATE_ZIP_URI, {
      encoding: null,
      headers: {
        'content-type': ZIP_CONTENT_TYPE,
        accept: ZIP_CONTENT_TYPE,
      },
    });
  } catch (err) {
    logger.error('An error occured fetching the theme source.');
    logErrorInstance(err);
  }
  return zip;
}

/**
 * @param {Buffer} zip
 * @returns {String|Null} Temp dir where zip has been extracted.
 */
async function extractThemeZip(zip) {
  if (!zip) return null;
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
  return extractPath;
}

/**
 * @param {String} src - Dir where boilerplate repo files have been extracted.
 * @param {String} dest - Dir to copy boilerplate src files to.
 */
async function copyThemeBoilerplateToDest(src, dest) {
  if (!src || !dest) return;
  try {
    const files = await fs.readdir(src);
    const rootDir = files[0];
    const themeSrcDir = path.join(src, rootDir, 'src');
    await fs.copy(themeSrcDir, dest);
  } catch (err) {
    logger.error(`An error occured copying theme source to "${dest}".`);
    logFileSystemErrorInstance(err, {
      filepath: dest,
      write: true,
    });
  }
}

/**
 * Writes a copy of the boilerplate theme to dest.
 * @param {String} dest - Dir top write theme src to.
 */
async function createTheme(dest) {
  const zip = await downloadCmsThemeBoilerplate();
  const extractFolder = await extractThemeZip(zip);
  await copyThemeBoilerplateToDest(extractFolder, dest);
}

module.exports = {
  createTheme,
};

import fs = require('fs-extra');
import path = require('path');
import os = require('os');
import { promisify } from 'util';

import request = require('request-promise-native');
const extract = promisify(require('extract-zip'));

import { logger } from './logger';
import { logFileSystemErrorInstance, logErrorInstance } from './errorHandlers';

// https://developer.github.com/v3/#user-agent-required
const USER_AGENT_HEADERS = { 'User-Agent': 'HubSpot/hubspot-cms-tools' };
const TMP_BOILERPLATE_FOLDER_PREFIX = 'hubspot-cms-theme-boilerplate-';

/**
 * https://developer.github.com/v3/repos/releases/#get-the-latest-release
 * @param {String} tag - Git tag to fetch for. If omitted latest will be fetched.
 */
export async function fetchReleaseData(tag = '') {
  tag = tag.trim().toLowerCase();
  if (tag.length && tag[0] !== 'v') {
    tag = `v${tag}`;
  }
  const URI = tag
    ? `https://api.github.com/repos/HubSpot/cms-theme-boilerplate/releases/tags/${tag}`
    : 'https://api.github.com/repos/HubSpot/cms-theme-boilerplate/releases/latest';
  try {
    return await request.get(URI, {
      headers: { ...USER_AGENT_HEADERS },
      json: true,
    });
  } catch (err) {
    logger.error(
      `Failed fetching release data for ${tag || 'latest'} theme boilerplate.`
    );
    if (tag && err.statusCode === 404) {
      logger.error(`Theme boilerplate ${tag} not found.`);
    }
  }
  return null;
}

/**
 * @param {String} tag - Git tag to fetch for. If omitted latest will be fetched.
 * @returns {Buffer|Null} Zip data buffer
 */
export async function downloadCmsThemeBoilerplate(tag = '') {
  try {
    const releaseData = await fetchReleaseData(tag);
    if (!releaseData) return;
    const { zipball_url: zipUrl, name } = releaseData;
    logger.log(`Fetching ${name}...`);
    const zip = await request.get(zipUrl, {
      encoding: null,
      headers: { ...USER_AGENT_HEADERS },
    });
    logger.log('Completed theme fetch.');
    return zip;
  } catch (err) {
    logger.error('An error occured fetching the theme source.');
    logErrorInstance(err);
  }
  return null;
}

/**
 * @param {Buffer} zip
 * @returns {String|Null} Temp dir where zip has been extracted.
 */
export async function extractThemeZip(zip) {
  logger.log('Extracting theme source...');
  // Write zip to disk
  let tmpDir;
  let tmpZipPath;
  try {
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), TMP_BOILERPLATE_FOLDER_PREFIX)
    );
    tmpZipPath = path.join(tmpDir, 'boilerplate.zip');
    await fs.ensureFile(tmpZipPath);
    await fs.writeFile(tmpZipPath, zip, {
      mode: 0o777,
    });
  } catch (err) {
    logger.error('An error occured writing temp theme source.');
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
    logger.error('An error occured extracting theme source.');
    logErrorInstance(err);
    return null;
  }
  logger.log('Completed theme source extraction.');
  return { extractDir, tmpDir };
}

/**
 * @param {String} src - Dir where boilerplate repo files have been extracted.
 * @param {String} dest - Dir to copy boilerplate src files to.
 * @returns {Boolean} `true` if successfully copied, `false` otherwise.
 */
async function copyThemeBoilerplateToDest(src, dest) {
  try {
    logger.log('Copying theme source...');
    const files = await fs.readdir(src);
    const rootDir = files[0];
    const themeSrcDir = path.join(src, rootDir, 'src');
    await fs.copy(themeSrcDir, dest);
    logger.log('Completed copying theme source.');
    return true;
  } catch (err) {
    logger.error(`An error occured copying theme source to ${dest}.`);
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
function cleanupTemp(tmpDir) {
  if (!tmpDir) return;
  try {
    fs.remove(tmpDir);
  } catch (e) {
    // noop
  }
}

/**
 * Writes a copy of the boilerplate theme to dest.
 * @param {String} dest - Dir top write theme src to.
 * @param {Object} options
 * @returns {Boolean} `true` if successful, `false` otherwise.
 */
export async function createTheme(dest, type, options = {}) {
  const { themeVersion: tag } = options;
  const zip = await downloadCmsThemeBoilerplate(tag);
  if (!zip) return false;
  const { extractDir, tmpDir } = (await extractThemeZip(zip)) || {};
  const success =
    extractDir != null && (await copyThemeBoilerplateToDest(extractDir, dest));
  if (success) {
    logger.success(`Your new ${type} project has been created in ${dest}`);
  }
  cleanupTemp(tmpDir);
  return success;
}

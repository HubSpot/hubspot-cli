const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { promisify } = require('util');

const request = require('request-promise-native');
const extract = promisify(require('extract-zip'));

const { logger } = require('./logger');
const {
  logFileSystemErrorInstance,
  logErrorInstance,
} = require('./errorHandlers');

// https://developer.github.com/v3/#user-agent-required
const USER_AGENT_HEADERS = { 'User-Agent': 'HubSpot/hubspot-cms-tools' };

/**
 * https://developer.github.com/v3/repos/releases/#get-the-latest-release
 * @param {String} tag - Git tag to fetch for. If omitted latest will be fetched.
 */
async function fetchReleaseData(repoName, tag = '') {
  tag = tag.trim().toLowerCase();
  if (tag.length && tag[0] !== 'v') {
    tag = `v${tag}`;
  }
  const URI = tag
    ? `https://api.github.com/repos/HubSpot/${repoName}/releases/tags/${tag}`
    : `https://api.github.com/repos/HubSpot/${repoName}/releases/latest`;
  try {
    return await request.get(URI, {
      headers: { ...USER_AGENT_HEADERS },
      json: true,
    });
  } catch (err) {
    logger.error(
      `Failed fetching release data for ${tag || 'latest'} project.`
    );
    if (tag && err.statusCode === 404) {
      logger.error(`project ${tag} not found.`);
    }
  }
  return null;
}

/**
 * @param {String} tag - Git tag to fetch for. If omitted latest will be fetched.
 * @returns {Buffer|Null} Zip data buffer
 */
async function downloadProject(repoName, tag = '') {
  try {
    const releaseData = await fetchReleaseData(repoName, tag);
    if (!releaseData) return;
    const { zipball_url: zipUrl, name } = releaseData;
    logger.log(`Fetching ${name}...`);
    const zip = await request.get(zipUrl, {
      encoding: null,
      headers: { ...USER_AGENT_HEADERS },
    });
    logger.log('Completed project fetch.');
    return zip;
  } catch (err) {
    logger.error('An error occured fetching the project source.');
    logErrorInstance(err);
  }
  return null;
}

/**
 * @param {Buffer} zip
 * @returns {String|Null} Temp dir where zip has been extracted.
 */
async function extractProjectZip(repoName, zip) {
  const TMP_BOILERPLATE_FOLDER_PREFIX = `hubspot-${repoName}-`;

  logger.log('Extracting project source...');
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
  logger.log('Completed project source extraction.');
  return { extractDir, tmpDir };
}

/**
 * @param {String} src - Dir where boilerplate repo files have been extracted.
 * @param {String} dest - Dir to copy boilerplate src files to.
 * @returns {Boolean} `true` if successfully copied, `false` otherwise.
 */
async function copyProjectToDest(src, sourceDir, dest) {
  try {
    logger.log('Copying project source...');
    const files = await fs.readdir(src);
    const rootDir = files[0];
    const projectSrcDir = path.join(src, rootDir, sourceDir);
    await fs.copy(projectSrcDir, dest);
    logger.log('Completed copying project source.');
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
function cleanupTemp(tmpDir) {
  if (!tmpDir) return;
  try {
    fs.remove(tmpDir);
  } catch (e) {
    // noop
  }
}

/**
 * Writes a copy of the boilerplate project to dest.
 * @param {String} dest - Dir to write project src to.
 * @param {String} type - Type of project to create.
 * @param {String} repoName - Name of GitHub repository to clone.
 * @param {String} sourceDir - Directory in project that should get copied.
 * @param {Object} options
 * @returns {Boolean} `true` if successful, `false` otherwise.
 */
async function createProject(dest, type, repoName, sourceDir, options = {}) {
  const { themeVersion, projectVersion } = options;
  const tag = projectVersion || themeVersion;
  const zip = await downloadProject(repoName, tag);
  if (!zip) return false;
  const { extractDir, tmpDir } = (await extractProjectZip(repoName, zip)) || {};
  const success =
    extractDir != null &&
    (await copyProjectToDest(extractDir, sourceDir, dest));
  if (success) {
    logger.success(`Your new ${type} project has been created in ${dest}`);
  }
  cleanupTemp(tmpDir);
  return success;
}

/**
 * Writes a copy of the boilerplate project to dest.
 * @param {String} dest - Dir to write project src to.
 * @param {String} type - Type of project to create.
 * @param {String} repoName - Name of GitHub repository to clone.
 * @param {String} sourceDir - Directory in project that should get copied.
 * @param {Object} options
 * @returns {Boolean} `true` if successful, `false` otherwise.
 */
async function createVueProject(dest, type, repoName) {
  const projectDestinationFolder = dest.match(/([^/]*)\/*$/)[1];

  return new Promise(resolve => {
    const vueInit = spawn(
      'vue',
      ['init', `HubSpot/${repoName}`, projectDestinationFolder],
      {
        stdio: 'inherit',
        shell: false,
      }
    );

    vueInit.on('exit', () => {
      resolve();
    });
  });
}

module.exports = {
  createProject,
  createVueProject,
  downloadProject,
  extractProjectZip,
  fetchReleaseData,
};

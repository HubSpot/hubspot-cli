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

const {
  GITHUB_RELEASE_TYPES,
  PROJECT_CONFIG_FILE,
  PROJECT_TEMPLATE_TYPES,
} = require('./lib/constants');
const { DEFAULT_USER_AGENT_HEADERS } = require('./http/requestOptions');

/**
 * https://developer.github.com/v3/repos/releases/#get-the-latest-release
 * @param {String} repoName - Name of GitHub repository to fetch.
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
      headers: { ...DEFAULT_USER_AGENT_HEADERS },
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
 * @param {String} repoName - Name of GitHub repository to download.
 * @param {String} tag - Git tag to fetch for. If omitted latest will be fetched.
 * @param {String} releaseType - type of content
 * @returns {Buffer|Null} Zip data buffer
 */
async function downloadProject(
  repoName,
  tag = '',
  releaseType = GITHUB_RELEASE_TYPES.RELEASE,
  ref
) {
  try {
    let zipUrl;
    if (releaseType === GITHUB_RELEASE_TYPES.REPOSITORY) {
      logger.log(`Fetching ${releaseType} with name ${repoName}...`);
      zipUrl = `https://api.github.com/repos/HubSpot/${repoName}/zipball/${ref}`;
    } else {
      const releaseData = await fetchReleaseData(repoName, tag);
      if (!releaseData) return;
      ({ zipball_url: zipUrl } = releaseData);
      const { name } = releaseData;
      logger.log(`Fetching ${name}...`);
    }
    const zip = await request.get(zipUrl, {
      encoding: null,
      headers: { ...DEFAULT_USER_AGENT_HEADERS },
    });
    logger.debug('Completed project fetch.');
    return zip;
  } catch (err) {
    logger.error('An error occured fetching the project source.');
    logErrorInstance(err);
  }
  return null;
}

/**
 * @param {String} repoName - Name of repository.
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
  logger.debug('Completed project source extraction.');
  return { extractDir, tmpDir };
}

/**
 * @param {String} src - Dir where boilerplate repo files have been extracted.
 * @param {String} sourceDir - Directory in project that should get copied.
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
  const { themeVersion, projectVersion, releaseType, ref } = options;
  const tag = projectVersion || themeVersion;
  const zip = await downloadProject(repoName, tag, releaseType, ref);
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

const createProjectConfig = (folderPath, configOptions = {}) => {
  const configPath = path.join(folderPath, PROJECT_CONFIG_FILE);

  logger.debug(`Creating config file ${configPath}`);
  return fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        label: configOptions.label || 'New project',
        description: configOptions.description || '',
      },
      null,
      2
    )
  );
};

const createProjectTemplateFiles = (projectPath, projectTemplate) => {
  const templateData = PROJECT_TEMPLATE_TYPES[projectTemplate];
  const files = templateData.files;

  Object.keys(files).forEach(fileName => {
    const filePath = path.join(projectPath, fileName);
    const fileContent = files[fileName];
    logger.debug(`Creating ${projectTemplate} template file ${filePath}`);
    fs.writeFileSync(filePath, fileContent);
  });
};

module.exports = {
  createProject,
  createProjectConfig,
  createProjectTemplateFiles,
  downloadProject,
  extractProjectZip,
  fetchReleaseData,
};

const request = require('request-promise-native');
const path = require('path');
const fs = require('fs-extra');

const { logger } = require('./logger');
const { logErrorInstance } = require('./errorHandlers');
const { extractZipArchive } = require('./archive');

const { GITHUB_RELEASE_TYPES } = require('./lib/constants');
const { i18n } = require('./lib/lang');
const { DEFAULT_USER_AGENT_HEADERS } = require('./http/requestOptions');

const GITHUB_AUTH_HEADERS = {
  authorization:
    global && global.githubToken ? `Bearer ${global.githubToken}` : null,
};

/**
 * @param {String} filePath - path where config file is stored
 * @param {String} repoName - name of the github repository
 * @returns {Buffer|Null} Zip data buffer
 */
async function fetchJsonFromRepository(repoName, filePath, repoPath = false) {
  try {
    let URI;
    if (repoPath) {
      URI = `https://raw.githubusercontent.com/${repoName}/${filePath}`;
    } else {
      URI = `https://raw.githubusercontent.com/HubSpot/${repoName}/${filePath}`;
    }
    logger.debug(`Fetching ${URI}...`);

    return await request.get(URI, {
      json: true,
      headers: { ...DEFAULT_USER_AGENT_HEADERS, ...GITHUB_AUTH_HEADERS },
    });
  } catch (err) {
    logger.error('An error occured fetching JSON file.');
    if (repoPath && err.statusCode === 404) {
      return logger.error(
        i18n(`cli.lib.prompts.createProjectPrompt.errors.failedtofetchJson`)
      );
    }
    logErrorInstance(err);
  }
  return null;
}

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
      headers: { ...DEFAULT_USER_AGENT_HEADERS, ...GITHUB_AUTH_HEADERS },
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
async function downloadGithubRepoZip(
  repoName,
  tag = '',
  releaseType = GITHUB_RELEASE_TYPES.RELEASE,
  ref
) {
  try {
    let zipUrl;
    if (releaseType === GITHUB_RELEASE_TYPES.REPOSITORY) {
      logger.log(`Fetching ${releaseType} with name ${repoName}...`);
      zipUrl = `https://api.github.com/repos/HubSpot/${repoName}/zipball${
        ref ? `/${ref}` : ''
      }`;
    } else {
      const releaseData = await fetchReleaseData(repoName, tag);
      if (!releaseData) return;
      ({ zipball_url: zipUrl } = releaseData);
      const { name } = releaseData;
      logger.log(`Fetching ${name}...`);
    }
    const zip = await request.get(zipUrl, {
      encoding: null,
      headers: { ...DEFAULT_USER_AGENT_HEADERS, ...GITHUB_AUTH_HEADERS },
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
 * Writes a copy of the boilerplate project to dest.
 * @param {String} dest - Dir to write project src to.
 * @param {String} type - Type of project to create.
 * @param {String} repoName - Name of GitHub repository to clone.
 * @param {String} sourceDir - Directory in project that should get copied.
 * @param {Object} options
 * @returns {Boolean} `true` if successful, `false` otherwise.
 */
async function cloneGitHubRepo(dest, type, repoName, sourceDir, options = {}) {
  const { themeVersion, projectVersion, releaseType, ref } = options;
  const tag = projectVersion || themeVersion;
  const zip = await downloadGithubRepoZip(repoName, tag, releaseType, ref);
  const success = await extractZipArchive(zip, repoName, dest, { sourceDir });

  if (success) {
    logger.success(`Your new ${type} has been created in ${dest}`);
  }
  return success;
}

async function getGitHubRepoContentsAtPath(
  repoPath = 'HubSpot/hubspot-project-components',
  path
) {
  const contentsRequestUrl = `https://api.github.com/repos/${repoPath}/contents/${path}`;

  return request.get(contentsRequestUrl, {
    json: true,
    headers: { ...DEFAULT_USER_AGENT_HEADERS, ...GITHUB_AUTH_HEADERS },
  });
}

async function fetchGitHubRepoContentFromDownloadUrl(dest, downloadUrl) {
  const resp = await request.get(downloadUrl, {
    headers: { ...DEFAULT_USER_AGENT_HEADERS, ...GITHUB_AUTH_HEADERS },
  });

  fs.outputFileSync(dest, resp, 'utf8');
}

/**
 * Writes files from a HubSpot public repository to the destination folder
 * @param {String} dest - Dir to write contents to
 * @param {String} repoName - Name of GitHub repository to fetch contents from
 * @param {String} path - Path to obtain contents from within repository
 * @returns {Boolean} `true` if successful, `false` otherwise.
 */
async function downloadGitHubRepoContents(
  repoName,
  contentPath,
  dest,
  options = {
    filter: false,
  }
) {
  fs.ensureDirSync(path.dirname(dest));

  try {
    const contentsResp = await getGitHubRepoContentsAtPath(
      repoName,
      contentPath
    );

    const downloadContentRecursively = async contentPiece => {
      const {
        path: contentPiecePath,
        download_url,
        type: contentPieceType,
      } = contentPiece;
      const downloadPath = path.join(
        dest,
        contentPiecePath.replace(contentPath, '')
      );

      if (
        typeof options.filter === 'function' &&
        !options.filter(contentPiecePath, downloadPath)
      ) {
        return Promise.resolve(null);
      }

      logger.debug(
        `Downloading content piece: ${contentPiecePath} from ${download_url} to ${downloadPath}`
      );

      if (contentPieceType === 'dir') {
        const innerDirContent = await getGitHubRepoContentsAtPath(
          repoName,
          contentPiecePath
        );
        return Promise.all(innerDirContent.map(downloadContentRecursively));
      } else {
        return fetchGitHubRepoContentFromDownloadUrl(
          downloadPath,
          download_url,
          {
            headers: {
              ...DEFAULT_USER_AGENT_HEADERS,
              ...GITHUB_AUTH_HEADERS,
            },
          }
        );
      }
    };

    let contentPromises;
    if (Array.isArray(contentsResp)) {
      contentPromises = contentsResp.map(downloadContentRecursively);
      return Promise.all(contentPromises);
    } else {
      contentPromises = downloadContentRecursively(contentsResp);
      return Promise.resolve(contentPromises);
    }
  } catch (e) {
    if (e.statusCode === 404) {
      if (e.error.message) {
        throw new Error(`Failed to fetch contents: ${e.error.message}`);
      }
    }

    throw new Error(e);
  }
}

module.exports = {
  cloneGitHubRepo,
  downloadGitHubRepoContents,
  fetchJsonFromRepository,
};

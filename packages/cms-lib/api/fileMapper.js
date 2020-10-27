const fs = require('fs-extra');
const path = require('path');
const contentDisposition = require('content-disposition');
const http = require('../http');
const { getCwd } = require('../path');
const { getEnv, getPortalConfig } = require('../lib/config');
const { logger } = require('../logger');

const FILE_MAPPER_API_PATH = 'content/filemapper/v1';

/**
 * @see {@link https://github.com/request/request-promise#the-transform-function}
 * @returns {FileMapperNode}
 */
function createFileMapperNodeFromStreamResponse(filePath, response) {
  if (filePath[0] !== '/') {
    filePath = `/${filePath}`;
  }
  if (filePath[filePath.length - 1] === '/') {
    filePath = filePath.slice(0, filePath.length - 1);
  }
  const node = {
    source: null,
    path: filePath,
    name: path.basename(filePath),
    folder: false,
    children: [],
    createdAt: 0,
    updatedAt: 0,
  };
  if (!(response.headers && response.headers['content-disposition'])) {
    return node;
  }
  const { parameters } = contentDisposition.parse(
    response.headers['content-disposition']
  );
  return {
    ...node,
    name: parameters.filename,
    createdAt: parseInt(parameters['creation-date'], 10) || 0,
    updatedAt: parseInt(parameters['modification-date'], 10) || 0,
  };
}

/**
 *
 * @async
 * @param {number} portalId
 * @param {string} src
 * @param {string} dest
 * @param {object} options
 * @returns {Promise}
 */
async function upload(portalId, src, dest, options = {}) {
  return http.post(portalId, {
    uri: `${FILE_MAPPER_API_PATH}/upload/${encodeURIComponent(dest)}`,
    formData: {
      file: fs.createReadStream(path.resolve(getCwd(), src)),
    },
    ...options,
  });
}

/**
 * Fetch a module by moduleId
 *
 * @async
 * @param {number} portalId
 * @param {number} moduleId
 * @param {object} options
 * @returns {Promise<FileMapperNode>}
 */
async function fetchModule(portalId, moduleId, options = {}) {
  return http.get(portalId, {
    uri: `${FILE_MAPPER_API_PATH}/modules/${moduleId}`,
    ...options,
  });
}

/**
 * Fetch a file by file path.
 *
 * @async
 * @param {number} portalId
 * @param {string} filePath
 * @param {stream.Writable} destination
 * @param {object} options
 * @returns {Promise<FileMapperNode>}
 */
async function fetchFileStream(portalId, filePath, destination, options = {}) {
  const response = await http.getOctetStream(
    portalId,
    {
      uri: `${FILE_MAPPER_API_PATH}/stream/${encodeURIComponent(filePath)}`,
      ...options,
    },
    destination
  );
  return createFileMapperNodeFromStreamResponse(filePath, response);
}

/**
 * Fetch a folder or file node by path.
 *
 * @async
 * @param {number} portalId
 * @param {string} filepath
 * @param {object} options
 * @returns {Promise<FileMapperNode>}
 */
async function download(portalId, filepath, options = {}) {
  return http.get(portalId, {
    uri: `${FILE_MAPPER_API_PATH}/download/${encodeURIComponent(filepath)}`,
    ...options,
  });
}

/**
 * Fetch a folder or file node by path.
 *
 * @async
 * @param {number} portalId
 * @param {string} filepath
 * @param {object} options
 * @returns {Promise<FileMapperNode>}
 */
async function downloadDefault(portalId, filepath, options = {}) {
  return http.get(portalId, {
    uri: `${FILE_MAPPER_API_PATH}/download-default/${filepath}`,
    ...options,
  });
}

/**
 * Delete a file or folder by path
 *
 * @async
 * @param {number} portalId
 * @param {string} filePath
 * @param {object} options
 * @returns {Promise}
 */
async function deleteFile(portalId, filePath, options = {}) {
  return http.delete(portalId, {
    uri: `${FILE_MAPPER_API_PATH}/delete/${filePath}`,
    ...options,
  });
}

/**
 * Delete folder by path
 *
 * @deprecated since 1.0.1 - use `deleteFile()` instead.
 * @async
 * @param {number} portalId
 * @param {string} folderPath
 * @param {object} options
 * @returns {Promise}
 */
async function deleteFolder(portalId, folderPath, options = {}) {
  logger.warn(
    '`cms-lib/api/fileMapper#deleteFolder()` is deprecated. Use `cms-lib/api/fileMapper#deleteFile()` instead.'
  );
  return http.delete(portalId, {
    uri: `${FILE_MAPPER_API_PATH}/delete/folder/${folderPath}`,
    ...options,
  });
}

/**
 * Track CMS CLI usage
 *
 * @async
 * @returns {Promise}
 */
async function trackUsage(eventName, eventClass, meta = {}, portalId) {
  const usageEvent = {
    portalId,
    eventName,
    eventClass,
    meta,
  };
  const path = `${FILE_MAPPER_API_PATH}/cms-cli-usage`;
  const portalConfig = portalId && getPortalConfig(portalId);

  if (portalConfig && portalConfig.authType === 'personalaccesskey') {
    logger.debug('Sending usage event to authenticated endpoint');
    return http.post(portalId, {
      uri: `${path}/authenticated`,
      body: usageEvent,
      resolveWithFullResponse: true,
    });
  }

  const env = getEnv(portalId);
  const requestOptions = http.getRequestOptions(
    { env },
    {
      uri: path,
      body: usageEvent,
      resolveWithFullResponse: true,
    }
  );
  logger.debug('Sending usage event to unauthenticated endpoint');
  return http.request.post(requestOptions);
}

/**
 * Moves file from srcPath to destPath
 *
 * @async
 * @param {number} portalId
 * @param {string} srcPath
 * @param {string} destPath
 * @returns {Promise}
 */
async function moveFile(portalId, srcPath, destPath) {
  console.log('moveFile: ', srcPath, destPath);
  const src = srcPath[0] === '/' ? srcPath.slice(1) : srcPath;
  const dest = destPath[0] === '/' ? destPath.slice(1) : destPath;

  return http.put(portalId, {
    uri: `${FILE_MAPPER_API_PATH}/rename/${src}?path=${dest}`,
  });
}

/**
 * Get directory contents
 *
 * @async
 * @param {string} path
 * @returns {Promise}
 */
async function getDirectoryContentsByPath(portalId, path) {
  return http.get(portalId, {
    uri: `${FILE_MAPPER_API_PATH}/meta/${path}`,
  });
}

module.exports = {
  deleteFile,
  deleteFolder,
  download,
  downloadDefault,
  fetchFileStream,
  fetchModule,
  trackUsage,
  upload,
  createFileMapperNodeFromStreamResponse,
  moveFile,
  getDirectoryContentsByPath,
};

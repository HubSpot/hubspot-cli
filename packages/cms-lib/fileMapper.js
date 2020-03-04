const fs = require('fs-extra');
const path = require('path');
const { default: PQueue } = require('p-queue');
const {
  ApiErrorContext,
  FileSystemErrorContext,
  logApiErrorInstance,
  logFileSystemErrorInstance,
} = require('./errorHandlers');
const { logger } = require('./logger');
const {
  getAllowedExtensions,
  getCwd,
  getExt,
  convertToLocalFileSystemPath,
} = require('./path');
const { fetchFileStream, download } = require('./api/fileMapper');
const {
  Mode,
  MODULE_EXTENSION,
  FUNCTIONS_EXTENSION,
} = require('./lib/constants');

const queue = new PQueue({
  concurrency: 10,
});

/**
 * @private
 * @param {string} filepath
 * @returns {boolean}
 */
function isPathToFile(filepath) {
  const ext = getExt(filepath);
  return !!ext && ext !== MODULE_EXTENSION && ext !== FUNCTIONS_EXTENSION;
}

/**
 * @private
 * @param {string} filepath
 * @returns {boolean}
 */
function isPathToModule(filepath) {
  const ext = getExt(filepath);
  return ext === MODULE_EXTENSION;
}

/**
 * @private
 * @param {string} filepath
 * @returns {boolean}
 */
function isPathToRoot(filepath) {
  if (typeof filepath !== 'string') return false;
  // Root pattern matches empty strings and: / \
  return /^(\/|\\)?$/.test(filepath.trim());
}

/**
 * @private
 * @param {string} filepath
 * @returns {boolean}
 */
function isAllowedExtension(filepath) {
  const ext = getExt(filepath);
  if (!ext) return false;
  return getAllowedExtensions().has(ext);
}

/**
 * Determines API `buffer` param based on mode.
 *
 * @param {Mode} mode
 */
function useApiBuffer(mode) {
  return mode === Mode.draft;
}

/**
 * @param {Mode} mode
 */
function getFileMapperApiQueryFromMode(mode) {
  return {
    buffer: useApiBuffer(mode),
  };
}

/**
 * TODO: Replace with TypeScript interface.
 * @typedef {Object} FileMapperNode A tree node from the filemapper API.
 * @property {string} path - Directory or file path.
 * @property {string|null} source - File source contents.
 * @property {number} id
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {FileMapperNode[]} children
 * @property {string} parentPath - Directory path of parent.
 * @property {boolean} folder - True if a folder, false otherwise.
 * @property {string} name - Name of file.
 */

/**
 * @private
 * @param {FileMapperNode} node
 * @throws {TypeError}
 */
function validateFileMapperNode(node) {
  if (node === Object(node)) return;
  let json;
  try {
    json = JSON.stringify(node, null, 2);
  } catch (err) {
    json = node;
  }
  throw new TypeError(`Invalid FileMapperNode: ${json}`);
}

/**
 * @callback recurseFileMapperNodeCallback
 * @param {FileMapperNode}     node
 * @param {Object}             options
 * @param {number}             options.depth
 * @param {string}             options.filepath
 * @returns {boolean} `false` to exit recursion.
 */

/**
 * @typedef {Object} FileMapperNodeMeta
 * @property {boolean} isBuiltin
 * @property {boolean} isModule
 */

/**
 * @private
 * @param {string} src
 * @returns {object<boolean, boolean, boolean, boolean}
 */
function getTypeDataFromPath(src) {
  const isModule = isPathToModule(src);
  const isFile = !isModule && isPathToFile(src);
  const isRoot = !isModule && !isFile && isPathToRoot(src);
  const isFolder = !isFile;
  return {
    isModule,
    isFile,
    isRoot,
    isFolder,
  };
}

/**
 * @typedef {Object} FileMapperInputArguments
 * @property {number} portalId
 * @property {string} src
 * @property {string} dest
 * @property {string} mode
 * @property {object} options
 */

/**
 * Recurse a FileMapperNode tree.
 *
 * @private
 * @param {FileMapperNode}                node
 * @param {recurseFileMapperNodeCallback} callback
 * @throws {Error}
 */
function recurseFolder(node, callback, filepath = '', depth = 0) {
  validateFileMapperNode(node);
  const isRootFolder = node.folder && depth === 0;
  if (isRootFolder) {
    if (!filepath) {
      filepath = node.name;
    }
  } else {
    filepath = path.join(filepath, node.name);
  }
  let __break = callback(node, { filepath, depth });
  if (__break === false) return __break;
  __break = node.children.every(childNode => {
    __break = recurseFolder(childNode, callback, filepath, depth + 1);
    return __break !== false;
  });
  return depth === 0 ? undefined : __break;
}

/**
 * @private
 * @async
 * @param {FileMapperInputArguments} input
 * @param {string} filepath
 * @param {FileMapperNode} node
 * @returns {Promise}
 */
async function writeUtimes(input, filepath, node) {
  try {
    const now = new Date();
    const atime = node.createdAt ? new Date(node.createdAt) : now;
    const mtime = node.updatedAt ? new Date(node.updatedAt) : now;
    await fs.utimes(filepath, atime, mtime);
  } catch (err) {
    logFileSystemErrorInstance(
      err,
      new FileSystemErrorContext({
        filepath,
        portalId: input.portalId,
        write: true,
      })
    );
  }
}

/**
 * @private
 * @async
 * @param {FileMapperInputArguments} input
 * @param {string} filepath
 * @returns {Promise<boolean}
 */
async function skipExisting(input, filepath) {
  if (input.options.overwrite) {
    return false;
  }
  if (await fs.pathExists(filepath)) {
    logger.log('Skipped existing "%s"', filepath);
    return true;
  }
  return false;
}

/**
 * @private
 * @async
 * @param {FileMapperInputArguments} input
 * @param {string} srcPath - Server path to download.
 * @param {string} filepath - Local path to write to.
 */
async function fetchAndWriteFileStream(input, srcPath, filepath) {
  if (typeof srcPath !== 'string' || !srcPath.trim()) {
    // This avoids issue where API was returning v1 modules with `path: ""`
    return null;
  }
  if (await skipExisting(input, filepath)) {
    return null;
  }
  if (!isAllowedExtension(srcPath)) {
    const message = `Invalid file type requested: "${srcPath}"`;
    logger.error(message);
    throw new Error(message);
  }
  const { portalId } = input;
  const logFsError = err => {
    logFileSystemErrorInstance(
      err,
      new FileSystemErrorContext({
        filepath,
        portalId,
        write: true,
      })
    );
  };
  let writeStream;
  try {
    await fs.ensureFile(filepath);
    writeStream = fs.createWriteStream(filepath, { encoding: 'binary' });
  } catch (err) {
    logFsError(err);
    throw err;
  }
  let node;
  try {
    node = await fetchFileStream(portalId, srcPath, writeStream, {
      qs: getFileMapperApiQueryFromMode(input.mode),
    });
  } catch (err) {
    logApiErrorInstance(
      err,
      new ApiErrorContext({
        portalId,
        request: srcPath,
      })
    );
    throw err;
  }
  return new Promise((resolve, reject) => {
    writeStream.on('error', err => {
      logFsError(err);
      reject(err);
    });
    writeStream.on('close', async () => {
      await writeUtimes(input, filepath, node);
      logger.log('Wrote file "%s"', filepath);
      resolve(node);
    });
  });
}

/**
 * Writes an individual file or folder (not recursive).  If file source is missing, the
 * file is fetched.
 *
 * @private
 * @async
 * @param {FileMapperInputArguments} input
 * @param {FileMapperNode}           node
 * @param {string}                   filepath
 * @returns {Promise}
 */
async function writeFileMapperNode(input, node, filepath) {
  filepath = convertToLocalFileSystemPath(path.resolve(filepath));
  if (await skipExisting(input, filepath)) {
    return;
  }
  if (!node.folder) {
    try {
      await fetchAndWriteFileStream(input, node.path, filepath);
    } catch (err) {
      // Logging handled by handler
    }
    return;
  }
  try {
    await fs.ensureDir(filepath);
    logger.log('Wrote folder "%s"', filepath);
  } catch (err) {
    logFileSystemErrorInstance(
      err,
      new FileSystemErrorContext({
        filepath,
        portalId: input.portalId,
        write: true,
      })
    );
  }
}

/**
 * @private
 * @async
 * @param {FileMapperInputArguments} input
 * @returns {Promise}
 */
async function downloadFile(input) {
  try {
    const { src } = input;
    const { isFile } = getTypeDataFromPath(src);
    if (!isFile) {
      throw new Error(`Invalid request for file: "${src}"`);
    }
    const dest = path.resolve(input.dest);
    const cwd = getCwd();
    let filepath;
    if (dest === cwd) {
      // Dest: CWD
      filepath = path.resolve(cwd, path.basename(src));
    } else if (isPathToFile(dest)) {
      // Dest: file path
      filepath = path.isAbsolute(dest) ? dest : path.resolve(cwd, dest);
    } else {
      // Dest: folder path
      const name = path.basename(src);
      filepath = path.isAbsolute(dest)
        ? path.resolve(dest, name)
        : path.resolve(cwd, dest, name);
    }
    const localFsPath = convertToLocalFileSystemPath(filepath);
    await fetchAndWriteFileStream(input, input.src, localFsPath);
    await queue.onIdle();
    logger.log('Completed fetch of file "%s" to "%s"', input.src, localFsPath);
  } catch (err) {
    logger.error('Failed fetch of file "%s" to "%s"', input.src, input.dest);
  }
}

/**
 * @private
 * @async
 * @param {FileMapperInputArguments} input
 * @returns {Promise<FileMapperNode}
 */
async function fetchFolderFromApi(input) {
  const { portalId, src, mode } = input;
  const { isRoot, isFolder } = getTypeDataFromPath(src);
  if (!isFolder) {
    throw new Error(`Invalid request for folder: "${src}"`);
  }
  try {
    const srcPath = isRoot ? '@root' : src;
    const node = await download(portalId, srcPath, {
      qs: getFileMapperApiQueryFromMode(mode),
    });
    logger.log('Fetched "%s" from portal %d successfully', src, portalId);
    return node;
  } catch (err) {
    logApiErrorInstance(
      err,
      new ApiErrorContext({
        portalId,
        request: src,
      })
    );
  }
  return null;
}

/**
 * @private
 * @async
 * @param {FileMapperInputArguments} input
 * @returns {Promise}
 */
async function downloadFolder(input) {
  try {
    const node = await fetchFolderFromApi(input);
    if (!node) {
      return;
    }
    const dest = path.resolve(input.dest);
    const rootPath =
      dest === getCwd()
        ? convertToLocalFileSystemPath(path.resolve(dest, node.name))
        : dest;
    recurseFolder(
      node,
      (childNode, { filepath }) => {
        queue.add(() => writeFileMapperNode(input, childNode, filepath));
      },
      rootPath
    );
    await queue.onIdle();
    logger.log('Completed fetch of folder "%s" to "%s"', input.src, input.dest);
  } catch (err) {
    logger.error('Failed fetch of folder "%s" to "%s"', input.src, input.dest);
  }
}

/**
 * Fetch a file/folder and write to local file system.
 *
 * @async
 * @param {FileMapperInputArguments} input
 * @returns {Promise}
 */
async function downloadFileOrFolder(input) {
  try {
    if (!(input && input.src)) {
      return;
    }
    const { isFile } = getTypeDataFromPath(input.src);
    if (isFile) {
      await downloadFile(input);
    } else {
      await downloadFolder(input);
    }
  } catch (err) {
    // Specific handlers provide logging.
  }
}

module.exports = {
  isPathToFile,
  isPathToModule,
  isPathToRoot,
  downloadFileOrFolder,
  recurseFolder,
  getFileMapperApiQueryFromMode,
  fetchFolderFromApi,
  getTypeDataFromPath,
};

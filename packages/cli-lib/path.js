const path = require('path');
const unixify = require('unixify');
const { ALLOWED_EXTENSIONS } = require('./lib/constants');

const convertToUnixPath = _path => {
  return unixify(path.normalize(_path));
};

const convertToWindowsPath = _path => {
  const rgx = new RegExp(`\\${path.posix.sep}`, 'g');
  return path.normalize(_path).replace(rgx, path.win32.sep);
};

/**
 * Converts a Win32 path to Posix, retaining the drive letter (ex. 'c:')
 *
 * @param {string} _path
 */
const convertToImportPath = _path => {
  if (path.sep === path.win32.sep) {
    return _path.split(path.win32.sep).join(path.posix.sep);
  }
  return _path;
};

const convertToLocalFileSystemPath = _path => {
  switch (path.sep) {
    case path.posix.sep:
      return convertToUnixPath(_path);
    case path.win32.sep:
      return convertToWindowsPath(_path);
    default:
      return path.normalize(_path);
  }
};

/**
 * @param {string[]} parts
 */
const removeTrailingSlashFromSplits = parts => {
  if (parts.length > 1 && parts[parts.length - 1] === '') {
    return parts.slice(0, parts.length - 1);
  }
  return parts;
};

/**
 * Splits a filepath for local file system sources.
 *
 * @param {string} filepath
 * @param {object} pathImplementation - For testing
 * @returns {string[]}
 */
const splitLocalPath = (filepath, pathImplementation = path) => {
  if (!filepath) return [];
  const { sep } = pathImplementation;
  const rgx = new RegExp(`\\${sep}+`, 'g');
  const parts = pathImplementation.normalize(filepath).split(rgx);
  // Restore posix root if present
  if (sep === path.posix.sep && parts[0] === '') {
    parts[0] = '/';
  }
  return removeTrailingSlashFromSplits(parts);
};

/**
 * Splits a filepath for remote sources (HubSpot).
 *
 * @param {string} filepath
 * @returns {string[]}
 */
const splitHubSpotPath = filepath => {
  if (!filepath) return [];
  const rgx = new RegExp(`\\${path.posix.sep}+`, 'g');
  const parts = convertToUnixPath(filepath).split(rgx);
  // Restore root if present
  if (parts[0] === '') {
    parts[0] = '/';
  }
  return removeTrailingSlashFromSplits(parts);
};

const getCwd = () => {
  if (process.env.INIT_CWD) {
    return process.env.INIT_CWD;
  }
  return process.cwd();
};

function getExt(filepath) {
  if (typeof filepath !== 'string') return '';
  const ext = path
    .extname(filepath)
    .trim()
    .toLowerCase();
  return ext[0] === '.' ? ext.slice(1) : ext;
}

const getAllowedExtensions = (allowList = []) => {
  return new Set([...Array.from(ALLOWED_EXTENSIONS), ...allowList]);
};

const isAllowedExtension = (filepath, allowList = []) => {
  const ext = getExt(filepath);
  const allowedExtensions = getAllowedExtensions(allowList);
  return allowedExtensions.has(ext);
};

const getAbsoluteFilePath = _path => path.resolve(getCwd(), _path);

const isRelativePath = _path => !path.isAbsolute(_path);

module.exports = {
  convertToUnixPath,
  convertToWindowsPath,
  convertToImportPath,
  convertToLocalFileSystemPath,
  getAllowedExtensions,
  getAbsoluteFilePath,
  getCwd,
  getExt,
  isAllowedExtension,
  isRelativePath,
  splitHubSpotPath,
  splitLocalPath,
};

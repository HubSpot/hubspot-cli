import path = require('path');
import unixify = require('unixify');
import { ALLOWED_EXTENSIONS } from './lib/constants';

export const convertToUnixPath = _path => {
  return unixify(path.normalize(_path));
};

export const convertToWindowsPath = _path => {
  const rgx = new RegExp(`\\${path.posix.sep}`, 'g');
  return path.normalize(_path).replace(rgx, path.win32.sep);
};

export const convertToLocalFileSystemPath = _path => {
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
export const removeTrailingSlashFromSplits = parts => {
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
export const splitLocalPath = (filepath, pathImplementation = path) => {
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
export const splitHubSpotPath = filepath => {
  if (!filepath) return [];
  const rgx = new RegExp(`\\${path.posix.sep}+`, 'g');
  const parts = convertToUnixPath(filepath).split(rgx);
  // Restore root if present
  if (parts[0] === '') {
    parts[0] = '/';
  }
  return removeTrailingSlashFromSplits(parts);
};

export const getCwd = () => {
  if (process.env.INIT_CWD) {
    return process.env.INIT_CWD;
  }
  return process.cwd();
};

export function getExt(filepath) {
  if (typeof filepath !== 'string') return '';
  const ext = path
    .extname(filepath)
    .trim()
    .toLowerCase();
  return ext[0] === '.' ? ext.slice(1) : ext;
}

export const getAllowedExtensions = () => {
  return ALLOWED_EXTENSIONS;
};

export const isAllowedExtension = filepath => {
  const ext = getExt(filepath);
  const allowedExtensions = getAllowedExtensions();
  return allowedExtensions.has(ext);
};

const path = require('path');
const unixify = require('unixify');
const { ALLOWED_EXTENSIONS } = require('./lib/constants');

const convertToUnixPath = _path => {
  return unixify(path.normalize(_path));
};

const convertToWindowsPath = _path => {
  return path.normalize(_path).replace(/\//g, '\\');
};

const convertToLocalFileSystemPath = _path => {
  switch (path.sep) {
    case '/':
      return convertToUnixPath(_path);
    case '\\':
      return convertToWindowsPath(_path);
    default:
      return path.normalize(_path);
  }
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

const getAllowedExtensions = () => {
  return ALLOWED_EXTENSIONS;
};

const isAllowedExtension = filepath => {
  const ext = getExt(filepath);
  const allowedExtensions = getAllowedExtensions();
  return allowedExtensions.has(ext);
};

module.exports = {
  convertToUnixPath,
  convertToWindowsPath,
  convertToLocalFileSystemPath,
  getAllowedExtensions,
  getCwd,
  getExt,
  isAllowedExtension,
};

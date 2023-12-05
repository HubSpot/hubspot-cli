const path = require('path');
const { getCwd } = require('@hubspot/local-dev-lib/path');
const { FOLDER_DOT_EXTENSIONS } = require('@hubspot/cli-lib/lib/constants');

function resolveLocalPath(filepath) {
  return filepath && typeof filepath === 'string'
    ? path.resolve(getCwd(), filepath)
    : // Use CWD if optional filepath is not passed.
      getCwd();
}

function isPathFolder(path) {
  const splitPath = path.split('/');
  const fileOrFolderName = splitPath[splitPath.length - 1];
  const splitName = fileOrFolderName.split('.');

  if (
    splitName.length > 1 &&
    FOLDER_DOT_EXTENSIONS.indexOf(splitName[1]) === -1
  ) {
    return false;
  }

  return true;
}

module.exports = {
  resolveLocalPath,
  isPathFolder,
};

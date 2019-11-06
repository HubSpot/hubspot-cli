const path = require('path');
const fs = require('fs-extra');
const { getCwd, getExt, splitHubSpotPath, splitLocalPath } = require('./path');
const { walk } = require('./lib/walk');
const { MODULE_EXTENSION } = require('./lib/constants');

const isBool = x => !!x === x;

/**
 * @typedef {object} PathInput
 * @property {string} path
 * @property {boolean} isLocal
 * @property {boolean} isHubSpot
 */

/**
 * @param {PathInput} pathInput
 * @returns {boolean}
 */
const isPathInput = pathInput => {
  return !!(
    pathInput &&
    typeof pathInput.path === 'string' &&
    (isBool(pathInput.isLocal) || isBool(pathInput.isHubSpot))
  );
};

const throwInvalidPathInput = pathInput => {
  if (isPathInput(pathInput)) return;
  throw new TypeError('Expected PathInput');
};

/**
 * @param {PathInput|string} pathInput
 * @returns {boolean}
 */
const isModuleFolder = pathInput => {
  const _path = isPathInput(pathInput) ? pathInput.path : pathInput;
  return getExt(_path) === MODULE_EXTENSION;
};

/**
 * @param {PathInput} pathInput
 * @returns {boolean}
 * @throws {TypeError}
 */
const isModuleFolderChild = pathInput => {
  throwInvalidPathInput(pathInput);
  let pathParts = [];
  if (pathInput.isLocal) {
    pathParts = splitLocalPath(pathInput.path);
  } else if (pathInput.isHubSpot) {
    pathParts = splitHubSpotPath(pathInput.path);
  }
  const { length } = pathParts;
  // Not a child path?
  if (length <= 1) return false;
  // Check if any parent folders are module folders.
  return pathParts.slice(0, length - 1).some(isModuleFolder);
};

// Ids for testing
const ValidationIds = {
  SRC_REQUIRED: 'SRC_REQUIRED',
  DEST_REQUIRED: 'DEST_REQUIRED',
  MODULE_FOLDER_REQUIRED: 'MODULE_FOLDER_REQUIRED',
  MODULE_TO_MODULE_NESTING: 'MODULE_TO_MODULE_NESTING',
  MODULE_NESTING: 'MODULE_NESTING',
};

const getValidationResult = (id, message) => ({ id, message });

/**
 * @param {PathInput} src
 * @param {PathInput} dest
 * @returns {object[]}
 */
async function validateSrcAndDestPaths(src, dest) {
  const results = [];
  if (!isPathInput(src)) {
    results.push(
      getValidationResult(ValidationIds.SRC_REQUIRED, '`src` is required.')
    );
  }
  if (!isPathInput(dest)) {
    results.push(
      getValidationResult(ValidationIds.DEST_REQUIRED, '`dest` is required.')
    );
  }
  if (results.length) {
    return results;
  }
  const [_src, _dest] = [src, dest].map(inputPath => {
    const result = { ...inputPath };
    if (result.isLocal) {
      result.path = path.resolve(getCwd(), result.path);
    }
    return result;
  });
  // src is a .module folder and dest is within a module. (Nesting)
  // e.g. `upload foo.module bar.module/zzz`
  // e.g. `fetch bar.module/zzz foo.module`
  if (isModuleFolder(_src) && isModuleFolderChild(_dest)) {
    return results.concat(
      getValidationResult(
        ValidationIds.MODULE_TO_MODULE_NESTING,
        '`src` is a module path and `dest` is within a module.'
      )
    );
  }
  // src is a .module folder but dest is not
  // e.g. `upload foo.module bar`
  // e.g. `fetch bar foo.module`
  if (isModuleFolder(_src) && !isModuleFolder(_dest)) {
    return results.concat(
      getValidationResult(
        ValidationIds.MODULE_FOLDER_REQUIRED,
        '`src` is a module path but `dest` is not.'
      )
    );
  }
  // src is a folder that includes modules and dest is within a module. (Nesting)
  if (_src.isLocal && isModuleFolderChild(_dest)) {
    const stat = await fs.stat(_src.path);
    if (stat.isDirectory()) {
      const files = await walk(_src.path);
      const srcHasModulesChildren = files.some(file =>
        isModuleFolderChild({ ..._src, path: file })
      );
      if (srcHasModulesChildren) {
        return results.concat(
          getValidationResult(
            ValidationIds.MODULE_NESTING,
            '`src` contains modules and `dest` is within a module.'
          )
        );
      }
    }
  }
  return results;
}

module.exports = {
  isModuleFolder,
  isModuleFolderChild,
  validateSrcAndDestPaths,
  ValidationIds,
};

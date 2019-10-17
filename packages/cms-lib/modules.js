const path = require('path');
const fs = require('fs-extra');
const { getCwd, getExt } = require('./path');
const { walk } = require('./lib/walk');
const { MODULE_EXTENSION } = require('./lib/constants');

const isModuleFolder = filepath => getExt(filepath) === MODULE_EXTENSION;
const isModuleFolderChild = filepath => {
  if (typeof filepath !== 'string') return false;
  if (isModuleFolder(filepath)) return true;
  return filepath.split(/\/|\\/).some(folder => isModuleFolder(folder));
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

async function validateSrcAndDestPaths(src, dest) {
  const results = [];
  if (typeof src !== 'string') {
    results.push(
      getValidationResult(ValidationIds.SRC_REQUIRED, '`src` is required.')
    );
  }
  if (typeof dest !== 'string') {
    results.push(
      getValidationResult(ValidationIds.DEST_REQUIRED, '`dest` is required.')
    );
  }
  if (results.length) {
    return results;
  }
  const absoluteSrc = path.resolve(getCwd(), src);
  // src is a .module folder and dest is within a module. (Nesting)
  // e.g. `upload foo.module bar.module/zzz`
  if (isModuleFolder(absoluteSrc) && isModuleFolderChild(dest)) {
    return results.concat(
      getValidationResult(
        ValidationIds.MODULE_TO_MODULE_NESTING,
        '`src` is a module path and `dest` is within a module.'
      )
    );
  }
  // src is a .module folder but dest is not
  // e.g. `upload foo.module bar`
  if (isModuleFolder(absoluteSrc) && !isModuleFolder(dest)) {
    return results.concat(
      getValidationResult(
        ValidationIds.MODULE_FOLDER_REQUIRED,
        '`src` is a module path but `dest` is not.'
      )
    );
  }
  // src is a folder that includes modules and dest is within a module. (Nesting)
  if (isModuleFolderChild(dest)) {
    const stat = await fs.stat(absoluteSrc);
    if (stat.isDirectory()) {
      const files = await walk(absoluteSrc);
      const srcHasModulesChildren = files.some(isModuleFolderChild);
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
  validateSrcAndDestPaths,
  ValidationIds,
};

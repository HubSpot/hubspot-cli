const fs = require('fs');
const path = require('path');

const BaseValidator = require('../BaseValidator');
const { isModuleFolderChild } = require('@hubspot/cli-lib/modules');

const MODULE_LIMIT = 50;

class ModuleValidator extends BaseValidator {
  constructor(options) {
    super(options);

    this.errors = {
      LIMIT_EXCEEDED: {
        key: 'limitExceeded',
        getCopy: ({ limit, total }) =>
          `Cannot exceed ${limit} modules in your theme (found ${total})`,
      },
      MISSING_META_JSON: {
        key: 'missingMetaJSON',
        getCopy: ({ file }) => `Missing a meta.json file for ${file}`,
      },
      INVALID_META_JSON: {
        key: 'invalidMetaJSON',
        getCopy: ({ file }) => `Invalid json in meta.json file for ${file}`,
      },
      MISSING_LABEL: {
        key: 'missingLabel',
        getCopy: ({ file }) =>
          `The meta.json file is missing a "label" field for ${file}`,
      },
      MISSING_ICON: {
        key: 'missingIcon',
        getCopy: ({ file }) =>
          `The meta.json file is missing an "icon" field for ${file}`,
      },
    };
  }

  getUniqueModulesFromFiles(files) {
    const uniqueModules = {};

    files.forEach(file => {
      if (isModuleFolderChild({ isLocal: true, path: file }, true)) {
        const { base, dir } = path.parse(file);
        if (!uniqueModules[dir]) {
          uniqueModules[dir] = {};
        }
        uniqueModules[dir][base] = file;
      }
    });
    return uniqueModules;
  }

  // Validates:
  // - Theme does not have more than MODULE_LIMIT modules
  // - Each module folder contains a meta.json file
  // - Each module meta.json file contains valid json
  // - Each module meta.json file has a "label" field
  // - Each module meta.json file has an "icon" field
  validate(files) {
    let validationErrors = [];
    const uniqueModules = this.getUniqueModulesFromFiles(files);
    const numModules = Object.keys(uniqueModules).length;

    if (numModules > MODULE_LIMIT) {
      validationErrors.push(
        this.getError(this.errors.LIMIT_EXCEEDED, null, {
          limit: MODULE_LIMIT,
          total: numModules,
        })
      );
    }

    Object.keys(uniqueModules).forEach(modulePath => {
      const metaJSONFile = uniqueModules[modulePath]['meta.json'];

      if (!metaJSONFile) {
        validationErrors.push(
          this.getError(this.errors.MISSING_META_JSON, modulePath)
        );
      } else {
        let metaJSON;
        try {
          metaJSON = JSON.parse(fs.readFileSync(metaJSONFile));
        } catch (err) {
          validationErrors.push(
            this.getError(this.errors.INVALID_META_JSON, modulePath)
          );
        }

        if (metaJSON) {
          if (!metaJSON.label) {
            validationErrors.push(
              this.getError(this.errors.MISSING_LABEL, modulePath)
            );
          }
          if (!metaJSON.icon) {
            validationErrors.push(
              this.getError(this.errors.MISSING_ICON, modulePath)
            );
          }
        }
      }
    });

    return validationErrors;
  }
}

module.exports = new ModuleValidator({
  name: 'Module',
  key: 'module',
});

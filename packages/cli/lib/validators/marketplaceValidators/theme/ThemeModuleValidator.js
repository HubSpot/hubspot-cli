const fs = require('fs');
const path = require('path');

const { isModuleFolderChild } = require('@hubspot/cli-lib/modules');
const AbsoluteValidator = require('../AbsoluteValidator');
const { VALIDATOR_KEYS } = require('../../constants');

const MODULE_LIMIT = 50;

class ThemeModuleValidator extends AbsoluteValidator {
  constructor(options) {
    super(options);

    this.errors = {
      LIMIT_EXCEEDED: {
        key: 'limitExceeded',
        getCopy: ({ limit, total }) =>
          `Module limit exceeded. Themes can only have ${limit} modules, but this theme has ${total}`,
      },
      MISSING_META_JSON: {
        key: 'missingMetaJSON',
        getCopy: ({ filePath }) =>
          `Module ${filePath} is missing the meta.json file`,
      },
      INVALID_META_JSON: {
        key: 'invalidMetaJSON',
        getCopy: ({ filePath }) =>
          `Module ${filePath} has invalid json in the meta.json file`,
      },
      MISSING_LABEL: {
        key: 'missingLabel',
        getCopy: ({ filePath }) =>
          `Missing required property for ${filePath}. The meta.json file is missing the "label" property`,
      },
      MISSING_ICON: {
        key: 'missingIcon',
        getCopy: ({ filePath }) =>
          `Missing required property for ${filePath}. The meta.json file is missing the "icon" property`,
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

module.exports = new ThemeModuleValidator({
  name: 'Theme modules',
  key: VALIDATOR_KEYS.themeModule,
});

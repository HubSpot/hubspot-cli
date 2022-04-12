const fs = require('fs');
const path = require('path');

const { isModuleFolderChild } = require('@hubspot/cli-lib/modules');
const RelativeValidator = require('../RelativeValidator');
const { VALIDATOR_KEYS } = require('../../constants');

class ModuleValidator extends RelativeValidator {
  constructor(options) {
    super(options);

    this.errors = {
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
  // - Module folder contains a meta.json file
  // - Module meta.json file contains valid json
  // - Module meta.json file has a "label" field
  // - Module meta.json file has an "icon" field
  validate(relativePath) {
    let validationErrors = [];
    const uniqueModules = this.getUniqueModulesFromFiles(relativePath);

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
  key: VALIDATOR_KEYS.module,
});

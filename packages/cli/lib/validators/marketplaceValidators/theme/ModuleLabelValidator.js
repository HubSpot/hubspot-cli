const fs = require('fs');
const { isModuleFolderChild } = require('@hubspot/cli-lib/modules');
const BaseValidator = require('../BaseValidator');

class ModuleLabelValidator extends BaseValidator {
  constructor(options) {
    super(options);

    this.errors = {
      MISSING: {
        key: 'missing',
        getCopy: ({ moduleName }) =>
          `Missing a meta.json file for ${moduleName}`,
      },
      INVALID: {
        key: 'invalid',
        getCopy: ({ moduleName }) =>
          `Invalid json in meta.json file for ${moduleName}`,
      },
      MISSING_LABEL: {
        key: 'missingLabel',
        getCopy: ({ moduleName }) =>
          `The meta.json file is missing a "label" field for ${moduleName}`,
      },
    };
  }

  getUniqueModulesAndMetaJSONFiles(files) {
    const uniqueModulesAndMetaJSONFiles = {};

    files.forEach(file => {
      if (isModuleFolderChild({ isLocal: true, path: file })) {
        // Get unique module path by removing the file name
        const modulePath = file.slice(0, file.lastIndexOf('/'));
        if (typeof uniqueModulesAndMetaJSONFiles[modulePath] !== 'string') {
          uniqueModulesAndMetaJSONFiles[modulePath] = null;
        }
        if (file.indexOf('meta.json') !== -1) {
          uniqueModulesAndMetaJSONFiles[modulePath] = file;
        }
      }
    });

    return uniqueModulesAndMetaJSONFiles;
  }

  // Validates:
  // - Each module folder contains a meta.json file
  // - Each module meta.json file contains valid json
  // - Each module meta.json file has a "label" field
  validate(absoluteThemePath, files) {
    let validationErrors = [];
    const modulesAndMetaJSONFiles = this.getUniqueModulesAndMetaJSONFiles(
      files
    );

    Object.keys(modulesAndMetaJSONFiles).forEach(moduleName => {
      const metaJSONFile = modulesAndMetaJSONFiles[moduleName];

      if (!metaJSONFile) {
        validationErrors.push(
          this.getError(this.errors.MISSING, { moduleName })
        );
      } else {
        let metaJSON;
        try {
          metaJSON = JSON.parse(fs.readFileSync(metaJSONFile));
        } catch (err) {
          validationErrors.push({
            ...this.getError(this.errors.INVALID, { moduleName }),
            meta: { file: metaJSONFile },
          });
        }

        if (metaJSON) {
          if (!metaJSON.label) {
            validationErrors.push({
              ...this.getError(this.errors.MISSING_LABEL, { moduleName }),
              meta: { file: metaJSONFile },
            });
          }
        }
      }
    });

    return validationErrors;
  }
}

module.exports = new ModuleLabelValidator({
  name: 'Module label',
  key: 'moduleLabel',
});

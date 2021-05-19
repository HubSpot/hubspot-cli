const fs = require('fs');
const BaseValidator = require('../BaseValidator');
const ValidatorStore = require('../../ValidatorStore');

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

  // Validates:
  // - Each module folder contains a meta.json file
  // - Each module meta.json file contains valid json
  // - Each module meta.json file has a "label" field
  validate(absoluteThemePath, files) {
    let validationErrors = [];
    const uniqueModules = ValidatorStore.getUniqueModulesFromFiles(files);

    Object.keys(uniqueModules).forEach(moduleName => {
      const metaJSONFile = uniqueModules[moduleName]['meta.json'];

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

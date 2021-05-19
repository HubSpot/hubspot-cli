const BaseValidator = require('../BaseValidator');
const ValidatorStore = require('../../ValidatorStore');

const MODULE_LIMIT = 50;

class ModuleCountValidator extends BaseValidator {
  constructor(options) {
    super(options);

    this.errors = {
      LIMIT_EXCEEDED: {
        key: 'limitExceeded',
        getCopy: ({ limit, total }) =>
          `Cannot exceed ${limit} modules in your theme (found ${total})`,
      },
    };
  }

  // Validates:
  // - Theme does not contain more than MODULE_LIMIT modules
  validate(absoluteThemePath, files) {
    let validationResult = [];
    const uniqueModules = ValidatorStore.getUniqueModulesFromFiles(files);
    const numModules = Object.keys(uniqueModules).length;

    if (numModules > MODULE_LIMIT) {
      validationResult.push(
        this.getError(this.errors.LIMIT_EXCEEDED, {
          limit: MODULE_LIMIT,
          total: numModules,
        })
      );
    }

    return validationResult;
  }
}

module.exports = new ModuleCountValidator({
  name: 'Module count',
  key: 'moduleCount',
});

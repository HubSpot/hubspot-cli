const { isModuleFolderChild } = require('@hubspot/cli-lib/modules');
const BaseValidator = require('../BaseValidator');

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

  getUniqueModuleCount(files) {
    const uniqueModules = {};

    files.forEach(file => {
      if (isModuleFolderChild({ isLocal: true, path: file })) {
        // Get unique module path by removing the file name
        const modulePath = file.slice(0, file.lastIndexOf('/'));
        if (!uniqueModules[modulePath]) {
          uniqueModules[modulePath] = true;
        }
      }
    });

    return Object.keys(uniqueModules).length;
  }

  // Validates:
  // - Theme does not contain more than MODULE_LIMIT modules
  validate(absoluteThemePath, files) {
    let validationResult = [];
    const numModules = this.getUniqueModuleCount(files);

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

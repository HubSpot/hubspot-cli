const fs = require('fs-extra');
const { HUBL_EXTENSIONS } = require('@hubspot/cli-lib/lib/constants');
const { validateHubl } = require('@hubspot/cli-lib/api/validate');
const {
  getDepsFromHublValidationObject,
} = require('@hubspot/cli-lib/validate');
const { getExt } = require('@hubspot/cli-lib/path');

const BaseValidator = require('../BaseValidator');

class DependencyValidator extends BaseValidator {
  constructor(options) {
    super(options);

    this.errors = {
      EXTERNAL_DEPENDENCY: {
        key: 'externalDependency',
        getCopy: () => `NO EXTERNAL DEPENDENCIES YOU FOOL`,
      },
      ABSOLUTE_DEPENDENCY_PATH: {
        key: 'absoluteDependencyPath',
        getCopy: () => `NO ABSOLUTE DEPENDENCY PATHS YOU FOOL`,
      },
    };
  }

  async getAllDependencies(files, accountId) {
    return Promise.all(
      files
        .filter(file => HUBL_EXTENSIONS.has(getExt(file)))
        .map(async file => {
          const source = await fs.readFile(file, { encoding: 'utf8' });
          if (!(source && source.trim())) {
            return {};
          }
          const validation = await validateHubl(accountId, source);
          return getDepsFromHublValidationObject(validation);
        })
    );
  }

  // Validates:
  // - Theme does not contain external dependencies
  // - All paths are either @hubspot or relative
  async validate(absoluteThemePath, files, accountId) {
    let validationErrors = [];

    const dependencies = await this.getAllDependencies(files, accountId);
    console.log(dependencies);
    //TODO branden parse these for external deps and non relative paths

    return validationErrors;
  }
}

module.exports = new DependencyValidator({
  name: 'Dependency',
  key: 'dependency',
});

const fs = require('fs-extra');
const { HUBL_EXTENSIONS } = require('@hubspot/cli-lib/lib/constants');
const { validateHubl } = require('@hubspot/cli-lib/api/validate');
const {
  getDepsFromHublValidationObject,
} = require('@hubspot/cli-lib/validate');
const { getExt, isRelativePath } = require('@hubspot/cli-lib/path');

const BaseValidator = require('../BaseValidator');

const MISSING_ASSET_CATEGORY_TYPES = ['MODULE_NOT_FOUND'];

class DependencyValidator extends BaseValidator {
  constructor(options) {
    super(options);

    this.errors = {
      EXTERNAL_DEPENDENCY: {
        key: 'externalDependency',
        getCopy: ({ path }) => `Path points to external dependency (${path})`,
      },
      ABSOLUTE_DEPENDENCY_PATH: {
        key: 'absoluteDependencyPath',
        getCopy: ({ path }) => `Dependency paths must be relative (${path})`,
      },
    };
  }

  // HACK We parse paths from rendering errors because the renderer won't
  // include paths in the all_dependencies object if it can't locate the asset
  getPathsFromRenderingErrors(validation) {
    return validation.renderingErrors
      .filter(renderingError =>
        MISSING_ASSET_CATEGORY_TYPES.includes(renderingError.category)
      )
      .map(renderingError => renderingError.categoryErrors.path);
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
          const deps = getDepsFromHublValidationObject(validation);
          deps.RENDERING_ERROR_PATHS = this.getPathsFromRenderingErrors(
            validation
          );
          return deps;
        })
    );
  }

  // TODO branden
  isExternalDep(absoluteThemePath, depPath) {
    console.log(depPath);
    return true;
  }

  // Validates:
  // - Theme does not contain external dependencies
  // - All paths are either @hubspot or relative
  async validate(absoluteThemePath, files, accountId) {
    let validationErrors = [];

    const dependencies = await this.getAllDependencies(files, accountId);
    console.log(dependencies);

    // TODO branden parse this correctly
    dependencies.forEach(dependency => {
      if (!isRelativePath(dependency)) {
        validationErrors.push({
          ...this.getError(this.errors.ABSOLUTE_DEPENDENCY_PATH, {
            path: dependency,
          }),
        });
      } else if (this.isExternalDep(absoluteThemePath, dependency)) {
        validationErrors.push({
          ...this.getError(this.errors.EXTERNAL_DEPENDENCY, {
            path: dependency,
          }),
        });
      }
    });
    return validationErrors;
  }
}

module.exports = new DependencyValidator({
  name: 'Dependency',
  key: 'dependency',
});

const fs = require('fs-extra');
const path = require('path');

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
        getCopy: ({ file, path }) =>
          `${file} contains a path that points to an external dependency (${path})`,
      },
      ABSOLUTE_DEPENDENCY_PATH: {
        key: 'absoluteDependencyPath',
        getCopy: ({ file, path }) =>
          `${file} contains an absolute path (${path})`,
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

  async getAllDependenciesByFile(files, accountId) {
    return Promise.all(
      files
        .filter(file => HUBL_EXTENSIONS.has(getExt(file)))
        .map(async file => {
          const source = await fs.readFile(file, { encoding: 'utf8' });
          if (!(source && source.trim())) {
            return { file, deps: {} };
          }
          const validation = await validateHubl(accountId, source);
          const deps = getDepsFromHublValidationObject(validation);
          deps.RENDERING_ERROR_PATHS = this.getPathsFromRenderingErrors(
            validation
          );
          return { file, deps };
        })
    );
  }

  isExternalDep(absoluteThemePath, depPath) {
    const relativePath = path.relative(absoluteThemePath, depPath);
    return relativePath && !relativePath.startsWith('..');
  }

  // Validates:
  // - Theme does not contain external dependencies
  // - All paths are either @hubspot or relative
  async validate(absoluteThemePath, files, accountId) {
    let validationErrors = [];

    const dependencyGroups = await this.getAllDependenciesByFile(
      files,
      accountId
    );

    dependencyGroups.forEach(depGroup => {
      const { file, deps } = depGroup;
      Object.keys(deps).forEach(key => {
        const depList = deps[key];
        depList.forEach(dependency => {
          // The BE will return '0' when no deps are found
          if (dependency !== '0') {
            if (!isRelativePath(dependency)) {
              validationErrors.push({
                ...this.getError(this.errors.ABSOLUTE_DEPENDENCY_PATH, {
                  file: path.relative(absoluteThemePath, file),
                  path: dependency,
                }),
              });
            } else if (this.isExternalDep(absoluteThemePath, dependency)) {
              validationErrors.push({
                ...this.getError(this.errors.EXTERNAL_DEPENDENCY, {
                  file: path.relative(absoluteThemePath, file),
                  path: dependency,
                }),
              });
            }
          }
        });
      });
    });
    return validationErrors;
  }
}

module.exports = new DependencyValidator({
  name: 'Dependency',
  key: 'dependency',
});

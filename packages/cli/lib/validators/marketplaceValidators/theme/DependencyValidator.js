const fs = require('fs-extra');
const path = require('path');

const { HUBL_EXTENSIONS } = require('@hubspot/cli-lib/lib/constants');
const { validateHubl } = require('@hubspot/cli-lib/api/validate');
const {
  getDepsFromHublValidationObject,
} = require('@hubspot/cli-lib/validate');
const { getExt, isRelativePath } = require('@hubspot/cli-lib/path');

const BaseValidator = require('../BaseValidator');

const MISSING_ASSET_CATEGORY_TYPES = [
  'MISSING_RESOURCE',
  'MISSING_TEMPLATE',
  'MODULE_NOT_FOUND',
];

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
      .filter(
        renderingError =>
          MISSING_ASSET_CATEGORY_TYPES.includes(renderingError.category) &&
          renderingError.categoryErrors.path
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

  isExternalDep(absoluteThemePath, file, relativeDepPath) {
    // Get dir of file that references the dep
    const { dir } = path.parse(file);
    // Use dir to get the dep's absolute path
    const absoluteDepPath = path.resolve(dir, relativeDepPath);
    // Get relative path to dep using theme absolute path and dep absolute path
    const relativePath = path.relative(absoluteThemePath, absoluteDepPath);
    // Check that dep is not within the theme
    return relativePath && relativePath.startsWith('..');
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
          // Ignore:
          // '0' - The BE will return '0' when no deps are found
          // '@' - Hubspot modules
          if (dependency !== '0' && !dependency.startsWith('@')) {
            if (!isRelativePath(dependency)) {
              validationErrors.push({
                ...this.getError(this.errors.ABSOLUTE_DEPENDENCY_PATH, {
                  file: path.relative(absoluteThemePath, file),
                  path: dependency,
                }),
              });
            } else if (
              this.isExternalDep(absoluteThemePath, file, dependency)
            ) {
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

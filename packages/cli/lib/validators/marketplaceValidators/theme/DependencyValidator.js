const fs = require('fs-extra');
const path = require('path');

const { logger } = require('@hubspot/cli-lib/logger');
const {
  HUBL_EXTENSIONS,
  HUBSPOT_FOLDER,
} = require('@hubspot/cli-lib/lib/constants');
const { fetchDependencies } = require('@hubspot/cli-lib/api/marketplace');
const { getExt, isRelativePath } = require('@hubspot/cli-lib/path');

const BaseValidator = require('../BaseValidator');
const { VALIDATOR_KEYS } = require('../../constants');

const MISSING_ASSET_CATEGORY_TYPES = [
  'MISSING_RESOURCE',
  'MISSING_TEMPLATE',
  'MODULE_NOT_FOUND',
];

class DependencyValidator extends BaseValidator {
  constructor(options) {
    super(options);

    this.errors = {
      FAILED_TO_FETCH_DEPS: {
        key: 'failedDepFetch',
        getCopy: ({ filePath }) =>
          `Internal Error. Failed to fetch dependencies for ${filePath}. Please try again`,
      },
      EXTERNAL_DEPENDENCY: {
        key: 'externalDependency',
        getCopy: ({ filePath, referencedFilePath }) =>
          `External dependency. ${filePath} references a file (${referencedFilePath}) that is outside of the theme`,
      },
      ABSOLUTE_DEPENDENCY_PATH: {
        key: 'absoluteDependencyPath',
        getCopy: ({ filePath, referencedFilePath }) =>
          `Relative path required. ${filePath} references a file (${referencedFilePath}) using an absolute path`,
      },
    };
  }

  // HACK We parse paths from rendering errors because the endpoint won't
  // include paths in the allDependencies object if it can't locate the asset
  getPathsFromRenderingErrors(renderingErrors = []) {
    return renderingErrors
      .filter(
        renderingError =>
          MISSING_ASSET_CATEGORY_TYPES.includes(renderingError.category) &&
          renderingError.categoryErrors.path
      )
      .map(renderingError => renderingError.categoryErrors.path);
  }

  failedToFetchDependencies(err, file, validationErrors) {
    logger.debug(`Failed to fetch dependencies for ${file}: `, err.error);

    validationErrors.push(
      this.getError(this.errors.FAILED_TO_FETCH_DEPS, file)
    );
  }

  async getAllDependenciesByFile(files, accountId, validationErrors) {
    return Promise.all(
      files
        .filter(file => HUBL_EXTENSIONS.has(getExt(file)))
        .map(async file => {
          const source = await fs.readFile(file, { encoding: 'utf8' });
          let deps = {};
          if (!(source && source.trim())) {
            return { file, deps };
          }
          const file_deps = await fetchDependencies(accountId, source).catch(
            err => {
              this.failedToFetchDependencies(err, file, validationErrors);
              return null;
            }
          );
          if (file_deps) {
            deps = file_deps.allDependencies || {};
            deps.RENDERING_ERROR_PATHS = this.getPathsFromRenderingErrors(
              file_deps.renderingErrors
            );
          }
          return { file, deps };
        })
    );
  }

  isExternalDep(file, relativeDepPath) {
    // Get dir of file that references the dep
    const { dir } = path.parse(file);
    // Use dir to get the dep's absolute path
    const absoluteDepPath = path.resolve(dir, relativeDepPath);
    // Get relative path to dep using theme absolute path and dep absolute path
    const relativePath = this.getRelativePath(absoluteDepPath);
    // Check that dep is not within the theme
    return relativePath && relativePath.startsWith('..');
  }

  // Validates:
  // - Theme does not contain external dependencies
  // - All paths are either @hubspot or relative
  async validate(files, accountId) {
    let validationErrors = [];

    const dependencyGroups = await this.getAllDependenciesByFile(
      files,
      accountId,
      validationErrors
    );

    dependencyGroups.forEach(depGroup => {
      const { file, deps } = depGroup;
      Object.keys(deps).forEach(key => {
        const depList = deps[key];
        depList.forEach(dependency => {
          // Ignore:
          // - The BE will return '0' when no deps are found
          // - Hubspot modules
          if (dependency !== '0' && !dependency.startsWith(HUBSPOT_FOLDER)) {
            if (!isRelativePath(dependency)) {
              validationErrors.push(
                this.getError(this.errors.ABSOLUTE_DEPENDENCY_PATH, file, {
                  referencedFilePath: dependency,
                })
              );
            } else if (this.isExternalDep(file, dependency)) {
              validationErrors.push(
                this.getError(this.errors.EXTERNAL_DEPENDENCY, file, {
                  referencedFilePath: dependency,
                })
              );
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
  key: VALIDATOR_KEYS.dependency,
});

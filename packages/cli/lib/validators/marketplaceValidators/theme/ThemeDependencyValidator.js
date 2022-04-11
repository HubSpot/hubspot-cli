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

class ThemeDependencyValidator extends BaseValidator {
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
          let deps = [];
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
            deps = file_deps.dependencies || [];
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

    const dependencyData = await this.getAllDependenciesByFile(
      files,
      accountId,
      validationErrors
    );

    dependencyData.forEach(depData => {
      const { file, deps } = depData;
      deps.forEach(dependency => {
        // Ignore:
        // - Hubspot modules
        if (!dependency.startsWith(HUBSPOT_FOLDER)) {
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

    return validationErrors;
  }
}

module.exports = new ThemeDependencyValidator({
  name: 'Theme dependency',
  key: VALIDATOR_KEYS.themeDependency,
});

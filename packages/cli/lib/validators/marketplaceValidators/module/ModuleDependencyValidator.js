//const fs = require('fs-extra');
const path = require('path');

const { logger } = require('@hubspot/cli-lib/logger');
const {
  //  HUBL_EXTENSIONS,
  HUBSPOT_FOLDER,
} = require('@hubspot/cli-lib/lib/constants');
const { fetchModuleDependencies } = require('@hubspot/cli-lib/api/marketplace');
const {
  //getExt,
  isRelativePath,
} = require('@hubspot/cli-lib/path');

const RelativeValidator = require('../RelativeValidator');
const { VALIDATOR_KEYS } = require('../../constants');

class ModuleDependencyValidator extends RelativeValidator {
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
          `External dependency. ${filePath} references a file (${referencedFilePath}) that is outside of the module`,
      },
      ABSOLUTE_DEPENDENCY_PATH: {
        key: 'absoluteDependencyPath',
        getCopy: ({ filePath, referencedFilePath }) =>
          `Relative path required. ${filePath} references a file (${referencedFilePath}) using an absolute path`,
      },
      ASSET_CO_LOCATION: {
        key: 'assetCoLocation',
        getCopy: ({ filePath }) =>
          `CSS/JS must be in the same folder as the module. ${filePath} has assets in the wrong place.`,
      },
    };
  }

  failedToFetchDependencies(err, relativePath, validationErrors) {
    logger.debug(
      `Failed to fetch dependencies for ${relativePath}: `,
      err.error
    );

    validationErrors.push(
      this.getError(this.errors.FAILED_TO_FETCH_DEPS, relativePath)
    );
  }

  async getAllDependenciesByPath(relativePath, accountId, validationErrors) {
    let deps = [];
    const file_deps = await fetchModuleDependencies(
      accountId,
      relativePath
    ).catch(err => {
      console.log(err);
      this.failedToFetchDependencies(err, relativePath, validationErrors);
      return null;
    });
    if (file_deps) {
      deps = file_deps.dependencies || [];
    }
    return deps;
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
  // - Module does not contain external dependencies
  // - All paths are either @hubspot or relative
  async validate(relativePath, accountId) {
    let validationErrors = [];

    console.log(relativePath);
    const dependencyData = await this.getAllDependenciesByPath(
      relativePath,
      accountId,
      validationErrors
    );
    console.log(dependencyData);
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

module.exports = new ModuleDependencyValidator({
  name: 'Module dependency',
  key: VALIDATOR_KEYS.moduleDependency,
});

const path = require('path');

const { logger } = require('@hubspot/cli-lib/logger');
const { HUBSPOT_FOLDER } = require('@hubspot/cli-lib/lib/constants');
const { fetchModuleDependencies } = require('@hubspot/cli-lib/api/marketplace');
const { isRelativePath } = require('@hubspot/cli-lib/path');

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
          `External dependency. ${filePath} references a file (${referencedFilePath}) that is outside of the module's immediate folder.`,
      },
      ABSOLUTE_DEPENDENCY_PATH: {
        key: 'absoluteDependencyPath',
        getCopy: ({ filePath, referencedFilePath }) =>
          `Relative path required. ${filePath} references a file (${referencedFilePath}) using an absolute path`,
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

  isExternalDep(relPath, relativeDepPath) {
    const moduleDir = path.parse(relPath).dir;
    const depDir = path.parse(relativeDepPath).dir;
    return !depDir.startsWith(moduleDir);
  }

  // Validates:
  // - Module does not contain external dependencies
  // - All paths are either @hubspot or relative
  async validate(relativePath, accountId) {
    let validationErrors = [];

    const dependencyData = await this.getAllDependenciesByPath(
      relativePath,
      accountId,
      validationErrors
    );
    dependencyData.forEach(dependency => {
      if (!dependency.startsWith(HUBSPOT_FOLDER)) {
        if (!isRelativePath(dependency)) {
          validationErrors.push(
            this.getError(this.errors.ABSOLUTE_DEPENDENCY_PATH, relativePath, {
              referencedFilePath: dependency,
            })
          );
        } else if (this.isExternalDep(relativePath, dependency)) {
          validationErrors.push(
            this.getError(this.errors.EXTERNAL_DEPENDENCY, relativePath, {
              referencedFilePath: dependency,
            })
          );
        }
      }
    });
    return validationErrors;
  }
}

module.exports = new ModuleDependencyValidator({
  name: 'Module dependency',
  key: VALIDATOR_KEYS.moduleDependency,
});

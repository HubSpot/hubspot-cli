const { logger } = require('@hubspot/cli-lib/logger');
const { fetchModuleMeta } = require('@hubspot/cli-lib/api/marketplace');
const RelativeValidator = require('../RelativeValidator');
const { VALIDATOR_KEYS } = require('../../constants');

class ModuleValidator extends RelativeValidator {
  constructor(options) {
    super(options);

    this.errors = {
      FAILED_TO_FETCH_META_JSON: {
        key: 'failedMetaFetch',
        getCopy: ({ filePath }) =>
          `Internal error. Failed to fetch meta.json for ${filePath}. Please try again.`,
      },
      MISSING_META_JSON: {
        key: 'missingMetaJSON',
        getCopy: ({ filePath }) =>
          `Module ${filePath} is missing the meta.json file`,
      },
      INVALID_META_JSON: {
        key: 'invalidMetaJSON',
        getCopy: ({ filePath }) =>
          `Module ${filePath} has invalid json in the meta.json file`,
      },
      MISSING_LABEL: {
        key: 'missingLabel',
        getCopy: ({ filePath }) =>
          `Missing required property for ${filePath}. The meta.json file is missing the "label" property`,
      },
      MISSING_ICON: {
        key: 'missingIcon',
        getCopy: ({ filePath }) =>
          `Missing required property for ${filePath}. The meta.json file is missing the "icon" property`,
      },
    };
  }
  failedToFetchDependencies(err, relativePath, validationErrors) {
    logger.debug(
      `Failed to fetch dependencies for ${relativePath}: `,
      err.error
    );
    validationErrors.push(
      this.getError(this.errors.FAILED_TO_FETCH_META_JSON, relativePath)
    );
  }

  async getModuleMetaByPath(relativePath, accountId, validationErrors) {
    const moduleMeta = await fetchModuleMeta(accountId, relativePath).catch(
      err => {
        console.log(err);
        this.failedToFetchDependencies(err, relativePath, validationErrors);
        return null;
      }
    );
    return moduleMeta;
  }

  // Validates:
  // - Module folder contains a meta.json file
  // - Module meta.json file contains valid json
  // - Module meta.json file has a "label" field
  // - Module meta.json file has an "icon" field
  async validate(relativePath, accountId) {
    let validationErrors = [];
    const metaJSONFile = await this.getModuleMetaByPath(
      relativePath,
      accountId,
      validationErrors
    );
    if (!metaJSONFile) {
      validationErrors.push(
        this.getError(this.errors.MISSING_META_JSON, relativePath)
      );
    }
    let metaJSON;
    try {
      metaJSON = JSON.parse(metaJSONFile.source);
    } catch (err) {
      validationErrors.push(
        this.getError(this.errors.INVALID_META_JSON, relativePath)
      );
    }
    if (metaJSON) {
      if (!metaJSON.label) {
        validationErrors.push(
          this.getError(this.errors.MISSING_LABEL, relativePath)
        );
      }
      if (!metaJSON.icon) {
        validationErrors.push(
          this.getError(this.errors.MISSING_ICON, relativePath)
        );
      }
    }
    return validationErrors;
  }
}

module.exports = new ModuleValidator({
  name: 'Module',
  key: VALIDATOR_KEYS.module,
});

const { getDirectoryFiles } = require('@hubspot/cli-lib/lib/walk');
const { ERROR_SEVERITY } = require('../validationErrorUtils');

const VALIDATOR_NAME = 'TemplateLimitValidator';
const TEMPLATE_LIMIT = 50;

// TODO branden are we checking for all files here? OR should we check for templates specifically

// Validate that the theme does not contain more than TEMPLATE_LIMIT templates
function templateLimitValidator(absoluteThemePath) {
  return getDirectoryFiles(absoluteThemePath).then(files => {
    let validationErrors = [];
    const numFiles = files.length;

    if (numFiles > TEMPLATE_LIMIT) {
      validationErrors.push({
        validator: VALIDATOR_NAME,
        error: `Cannot exceed ${TEMPLATE_LIMIT} templates in your theme (found ${numFiles})`,
        severity: ERROR_SEVERITY.FATAL,
      });
    }

    return validationErrors;
  });
}

module.exports = { validate: templateLimitValidator };

const { walk } = require('@hubspot/cli-lib/lib/walk');
const { ERROR_SEVERITY } = require('../constants');

const VALIDATOR_NAME = 'TemplateLimitValidator';
const TEMPLATE_LIMIT = 50;
const TEMPLATE_REGEX = new RegExp(/.html+$/);

// Validate that the theme does not contain more than TEMPLATE_LIMIT templates
function templateLimitValidator(absoluteThemePath) {
  return walk(absoluteThemePath).then(files => {
    let validationErrors = [];
    const numTemplates = files.filter(file => TEMPLATE_REGEX.test(file)).length;

    if (numTemplates > TEMPLATE_LIMIT) {
      validationErrors.push({
        validator: VALIDATOR_NAME,
        error: `Cannot exceed ${TEMPLATE_LIMIT} templates in your theme (found ${numTemplates})`,
        severity: ERROR_SEVERITY.FATAL,
      });
    }

    return validationErrors;
  });
}

module.exports = { validate: templateLimitValidator };

const { isTemplate } = require('@hubspot/cli-lib/templates');

const { VALIDATION_RESULT } = require('../constants');

const VALIDATOR_NAME = 'TemplateLimitValidator';
const TEMPLATE_LIMIT = 50;

// Validate that the theme does not contain more than TEMPLATE_LIMIT templates
function templateLimitValidator(absoluteThemePath, files) {
  let validationResult = [];
  const templates = files.filter(isTemplate);

  const numTemplates = templates.length;

  if (numTemplates > TEMPLATE_LIMIT) {
    validationResult.push({
      validator: VALIDATOR_NAME,
      error: `Cannot exceed ${TEMPLATE_LIMIT} templates in your theme (found ${numTemplates})`,
      result: VALIDATION_RESULT.FATAL,
    });
  }

  return validationResult;
}

module.exports = {
  name: VALIDATOR_NAME,
  validate: templateLimitValidator,
};

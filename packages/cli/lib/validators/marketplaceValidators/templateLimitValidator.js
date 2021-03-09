const { walk } = require('@hubspot/cli-lib/lib/walk');
const { VALIDATION_RESULT } = require('../constants');

const VALIDATOR_NAME = 'TemplateLimitValidator';
const TEMPLATE_LIMIT = 50;
const TEMPLATE_REGEX = new RegExp(/.html+$/);

// Validate that the theme does not contain more than TEMPLATE_LIMIT templates
async function templateLimitValidator(absoluteThemePath) {
  return walk(absoluteThemePath).then(files => {
    let validationResult = [];
    const numTemplates = files.filter(file => TEMPLATE_REGEX.test(file)).length;

    if (numTemplates > TEMPLATE_LIMIT) {
      validationResult.push({
        validator: VALIDATOR_NAME,
        error: `Cannot exceed ${TEMPLATE_LIMIT} templates in your theme (found ${numTemplates})`,
        result: VALIDATION_RESULT.FATAL,
      });
    }

    return validationResult;
  });
}

module.exports = {
  name: VALIDATOR_NAME,
  validate: templateLimitValidator,
};

const { isTemplate } = require('@hubspot/cli-lib/templates');
const BaseValidator = require('../BaseValidator');

const TEMPLATE_LIMIT = 50;

class TemplateValidator extends BaseValidator {
  constructor(options) {
    super(options);

    this.errors = {
      LIMIT_EXCEEDED: {
        key: 'limitExceeded',
        getCopy: ({ limit, total }) =>
          `Cannot exceed ${limit} templates in your theme (found ${total})`,
      },
    };
  }

  // Validates:
  // - Theme does not contain more than TEMPLATE_LIMIT templates
  validate(absoluteThemePath, files) {
    let validationResult = [];
    const templates = files.filter(isTemplate);
    const numTemplates = templates.length;

    if (numTemplates > TEMPLATE_LIMIT) {
      validationResult.push(
        this.getError(this.errors.LIMIT_EXCEEDED, {
          limit: TEMPLATE_LIMIT,
          total: numTemplates,
        })
      );
    }

    return validationResult;
  }
}

module.exports = new TemplateValidator({
  name: 'Template',
  key: 'template',
});

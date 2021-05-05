const { isTemplate } = require('@hubspot/cli-lib/templates');

const BaseValidator = require('../BaseValidator');

const TEMPLATE_LIMIT = 50;
class TemplateLimitValidator extends BaseValidator {
  constructor() {
    super();
    this.name = 'Template limit';
    this.key = 'templateLimit';
    this.errors = {
      LIMIT_EXCEEDED: {
        key: 'limitExceeded',
        getCopy: ({ limit, total }) =>
          `Cannot exceed ${limit} templates in your theme (found ${total})`,
      },
    };
  }

  // Validate that the theme does not contain more than TEMPLATE_LIMIT templates
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

module.exports = new TemplateLimitValidator();

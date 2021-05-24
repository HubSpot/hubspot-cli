const path = require('path');

const {
  ANNOTATION_KEYS,
  getAnnotationValue,
  getFileAnnotations,
  isTemplate,
} = require('@hubspot/cli-lib/templates');
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
      MISSING_LABEL: {
        key: 'missingLabel',
        getCopy: ({ templatePath }) =>
          `Missing a "label" annotation in ${templatePath}`,
      },
      MISSING_SCREENSHOT_PATH: {
        key: 'missingScreenshotPath',
        getCopy: ({ templatePath }) =>
          `The screenshotPath is missing in ${templatePath}`,
      },
    };
  }

  // Validates:
  // - Theme does not contain more than TEMPLATE_LIMIT templates
  // - All templates have a "label" annotation
  validate(absoluteThemePath, files) {
    let validationErrors = [];
    const templates = files.filter(isTemplate);
    const numTemplates = templates.length;

    if (numTemplates > TEMPLATE_LIMIT) {
      validationErrors.push(
        this.getError(this.errors.LIMIT_EXCEEDED, {
          limit: TEMPLATE_LIMIT,
          total: numTemplates,
        })
      );
    }

    templates.forEach(templatePath => {
      const annotations = getFileAnnotations(templatePath);
      const label = getAnnotationValue(annotations, ANNOTATION_KEYS.label);
      const sreenshotPath = getAnnotationValue(
        annotations,
        ANNOTATION_KEYS.screenshotPath
      );

      if (!label) {
        validationErrors.push(
          this.getError(this.errors.MISSING_LABEL, {
            templatePath: path.relative(absoluteThemePath, templatePath),
          })
        );
      }
      if (!sreenshotPath) {
        validationErrors.push(
          this.getError(this.errors.MISSING_SCREENSHOT_PATH, {
            templatePath: path.relative(absoluteThemePath, templatePath),
          })
        );
      }
    });

    return validationErrors;
  }
}

module.exports = new TemplateValidator({
  name: 'Template',
  key: 'template',
});

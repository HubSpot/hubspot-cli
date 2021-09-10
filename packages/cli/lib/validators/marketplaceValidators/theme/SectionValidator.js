const {
  ANNOTATION_KEYS,
  getAnnotationValue,
  getFileAnnotations,
} = require('@hubspot/cli-lib/templates');
const BaseValidator = require('../BaseValidator');
const { VALIDATOR_KEYS } = require('../../constants');

const SECTION_LIMIT = 50;

class SectionValidator extends BaseValidator {
  constructor(options) {
    super(options);

    this.errors = {
      LIMIT_EXCEEDED: {
        key: 'limitExceeded',
        getCopy: ({ limit, total }) =>
          `Section limit exceeded. Themes can only have ${limit} sections, but this theme has ${total}`,
      },
      MISSING_LABEL: {
        key: 'missingLabel',
        getCopy: ({ filePath }) =>
          `Missing required property for ${filePath}. The section is missing the "label" property`,
      },
      MISSING_SCREENSHOT_PATH: {
        key: 'missingScreenshotPath',
        getCopy: ({ filePath }) =>
          `Missing required property for ${filePath}. The section is missing the "screenshotPath" property`,
      },
      MISSING_DESCRIPTION: {
        key: 'missingDescription',
        getCopy: ({ filePath }) =>
          `Missing required property for ${filePath}. The section is missing the "description" property`,
      },
    };
  }

  // Validates:
  // - All sections have a "description" annotation
  // - All sections have a "label" annotation
  // - All sections have a "screenshotPath" annotation
  // - Theme does not have more than SECTION_LIMIT sections

  validate(files) {
    let validationErrors = [];
    let sectionCount = 0;

    files.forEach(file => {
      if (file) {
        const annotations = getFileAnnotations(file);
        const templateType = getAnnotationValue(
          annotations,
          ANNOTATION_KEYS.templateType
        );

        if (templateType !== 'section') {
          return;
        }
        sectionCount++;

        const description = getAnnotationValue(
          annotations,
          ANNOTATION_KEYS.description
        );
        const label = getAnnotationValue(annotations, ANNOTATION_KEYS.label);
        const screenshotPath = getAnnotationValue(
          annotations,
          ANNOTATION_KEYS.screenshotPath
        );

        if (!description) {
          validationErrors.push(
            this.getError(this.errors.MISSING_DESCRIPTION, file)
          );
        }
        if (!label) {
          validationErrors.push(this.getError(this.errors.MISSING_LABEL, file));
        }
        if (!screenshotPath) {
          validationErrors.push(
            this.getError(this.errors.MISSING_SCREENSHOT_PATH, file)
          );
        }
      }
    });

    if (sectionCount > SECTION_LIMIT) {
      validationErrors.push(
        this.getError(this.errors.LIMIT_EXCEEDED, null, {
          limit: SECTION_LIMIT,
          total: sectionCount,
        })
      );
    }

    return validationErrors;
  }
}

module.exports = new SectionValidator({
  name: 'Section',
  key: VALIDATOR_KEYS.section,
});

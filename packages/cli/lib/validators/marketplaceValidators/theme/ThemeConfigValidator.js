const fs = require('fs');
const BaseValidator = require('../BaseValidator');

class ThemeConfigValidator extends BaseValidator {
  constructor() {
    super();
    this.name = 'Theme config';
    this.key = 'themeConfig';
    this.errors = {
      MISSING: {
        key: 'missing',
        getCopy: () => 'Missing a theme.json file',
      },
      INVALID: {
        key: 'invalid',
        getCopy: () => 'Invalid json in theme.json file',
      },
      MISSING_LABEL: {
        key: 'missingLabel',
        getCopy: () => 'The theme.json file is missing a "label" field',
      },
    };
  }

  // Validates:
  // - Theme contains a theme.json file at the theme root dir
  // - theme.json file contains valid json
  // - theme.json file has a "label" field
  validate(absoluteThemePath, files) {
    let validationErrors = [];
    const themeJSONFile = files.find(filePath => {
      // Check for theme.json at the theme root
      const fileName = filePath.replace(`${absoluteThemePath}/`, '');
      return fileName === 'theme.json';
    });

    if (!themeJSONFile) {
      validationErrors.push(this.getError(this.errors.MISSING));
    } else {
      let themeJSON;

      try {
        themeJSON = JSON.parse(fs.readFileSync(themeJSONFile));
      } catch (err) {
        validationErrors.push({
          ...this.getError(this.errors.INVALID),
          meta: { file: themeJSONFile },
        });
      }

      if (themeJSON) {
        if (!themeJSON.label) {
          validationErrors.push({
            ...this.getError(this.errors.MISSING_LABEL),
            meta: { file: themeJSONFile },
          });
        }
      }
    }

    return validationErrors;
  }
}

module.exports = new ThemeConfigValidator();

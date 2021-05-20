const fs = require('fs');
const BaseValidator = require('../BaseValidator');

class ThemeValidator extends BaseValidator {
  constructor(options) {
    super(options);

    this.errors = {
      MISSING_THEME_JSON: {
        key: 'missingThemeJSON',
        getCopy: () => 'Missing a theme.json file',
      },
      INVALID_THEME_JSON: {
        key: 'invalidThemeJSON',
        getCopy: () => 'Invalid json in theme.json file',
      },
      MISSING_LABEL: {
        key: 'missingLabel',
        getCopy: () => 'The theme.json file is missing a "label" field',
      },
      INVALID_SCREENSHOT_PATH: {
        key: 'invalidScreenshotPath',
        getCopy: () =>
          'The path for "screenshot_path" in theme.json must be relative',
      },
    };
  }

  // Validates:
  // - Theme contains a theme.json file at the theme root dir
  // - theme.json file contains valid json
  // - theme.json file has a "label" field
  // - theme.json file has a relative path for "screenshot" field
  validate(absoluteThemePath, files) {
    let validationErrors = [];
    const themeJSONFile = files.find(filePath => {
      // Check for theme.json at the theme root
      const fileName = filePath.replace(`${absoluteThemePath}/`, '');
      return fileName === 'theme.json';
    });

    if (!themeJSONFile) {
      validationErrors.push(this.getError(this.errors.MISSING_THEME_JSON));
    } else {
      let themeJSON;

      try {
        themeJSON = JSON.parse(fs.readFileSync(themeJSONFile));
      } catch (err) {
        validationErrors.push({
          ...this.getError(this.errors.INVALID_THEME_JSON),
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
        if (!themeJSON.screenshot_path) {
          //TODO branden also check if path is relative before throwing error
          validationErrors.push({
            ...this.getError(this.errors.INVALID_SCREENSHOT_PATH),
            meta: { file: themeJSONFile },
          });
        }
      }
    }

    return validationErrors;
  }
}

module.exports = new ThemeValidator({
  name: 'Theme',
  key: 'theme',
});

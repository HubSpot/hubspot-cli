const fs = require('fs');
const path = require('path');

const BaseValidator = require('../BaseValidator');
const { isRelativePath } = require('@hubspot/cli-lib/path');

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
      MISSING_SCREENSHOT_PATH: {
        key: 'missingScreenshotPath',
        getCopy: () =>
          'The theme.json file is missing a "screenshot_path" field',
      },
      ABSOLUTE_SCREENSHOT_PATH: {
        key: 'absoluteScreenshotPath',
        getCopy: () =>
          'The path for "screenshot_path" in theme.json must be relative',
      },
      MISSING_SCREENSHOT: {
        key: 'missingScreenshot',
        getCopy: () =>
          'The path for "screenshot_path" in theme.json is not resolving',
      },
    };
  }

  // Validates:
  // - Theme contains a theme.json file at the theme root dir
  // - theme.json file contains valid json
  // - theme.json file has a "label" field
  // - theme.json file has a relative path for "screenshot" field that resolves
  validate(absoluteThemePath, files) {
    let validationErrors = [];
    const themeJSONFile = files.find(filePath => {
      // Check for theme.json at the theme root
      const fileName = path.relative(absoluteThemePath, filePath);
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
          validationErrors.push({
            ...this.getError(this.errors.MISSING_SCREENSHOT_PATH),
            meta: { file: themeJSONFile },
          });
        } else if (!isRelativePath(themeJSON.screenshot_path)) {
          validationErrors.push({
            ...this.getError(this.errors.ABSOLUTE_SCREENSHOT_PATH),
            meta: { file: themeJSONFile },
          });
        } else {
          const absoluteScreenshotPath = path.resolve(
            absoluteThemePath,
            themeJSON.screenshot_path
          );
          if (!fs.existsSync(absoluteScreenshotPath)) {
            validationErrors.push({
              ...this.getError(this.errors.MISSING_SCREENSHOT),
              meta: { file: themeJSONFile },
            });
          }
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

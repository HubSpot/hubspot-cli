const fs = require('fs');
const path = require('path');

const { isRelativePath } = require('@hubspot/cli-lib/path');
const AbsoluteValidator = require('../AbsoluteValidator');
const { VALIDATOR_KEYS } = require('../../constants');

class ThemeValidator extends AbsoluteValidator {
  constructor(options) {
    super(options);

    this.errors = {
      MISSING_THEME_JSON: {
        key: 'missingThemeJSON',
        getCopy: () =>
          'Missing the theme.json file. This file is required in all themes',
      },
      INVALID_THEME_JSON: {
        key: 'invalidThemeJSON',
        getCopy: ({ filePath }) => `Invalid json in the ${filePath} file`,
      },
      MISSING_LABEL: {
        key: 'missingLabel',
        getCopy: ({ filePath }) =>
          `Missing required field in ${filePath}. The "label" field is required`,
      },
      MISSING_SCREENSHOT_PATH: {
        key: 'missingScreenshotPath',
        getCopy: ({ filePath }) =>
          `Missing required field in ${filePath}. The "screenshot_path" field is required`,
      },
      ABSOLUTE_SCREENSHOT_PATH: {
        key: 'absoluteScreenshotPath',
        getCopy: ({ fieldPath }) =>
          `Relative path required. The path for "screenshot_path" in ${fieldPath} must be relative`,
      },
      MISSING_SCREENSHOT: {
        key: 'missingScreenshot',
        getCopy: ({ fieldPath }) =>
          `File not found. No file exists for the provided "screenshot_path" in ${fieldPath}`,
      },
    };
  }

  // Validates:
  // - Theme contains a theme.json file at the theme root dir
  // - theme.json file contains valid json
  // - theme.json file has a "label" field
  // - theme.json file has a relative path for "screenshot" field that resolves
  validate(files) {
    let validationErrors = [];
    const themeJSONFile = files.find(filePath => {
      // Check for theme.json at the theme root
      const fileName = this.getRelativePath(filePath);
      return fileName === 'theme.json';
    });

    if (!themeJSONFile) {
      validationErrors.push(this.getError(this.errors.MISSING_THEME_JSON));
    } else {
      let themeJSON;

      try {
        themeJSON = JSON.parse(fs.readFileSync(themeJSONFile));
      } catch (err) {
        validationErrors.push(
          this.getError(this.errors.INVALID_THEME_JSON, themeJSONFile)
        );
      }

      if (themeJSON) {
        if (!themeJSON.label) {
          validationErrors.push(
            this.getError(this.errors.MISSING_LABEL, themeJSONFile)
          );
        }
        if (!themeJSON.screenshot_path) {
          validationErrors.push(
            this.getError(this.errors.MISSING_SCREENSHOT_PATH, themeJSONFile)
          );
        } else if (!isRelativePath(themeJSON.screenshot_path)) {
          validationErrors.push(
            this.getError(this.errors.ABSOLUTE_SCREENSHOT_PATH, themeJSONFile)
          );
        } else {
          const absoluteScreenshotPath = path.resolve(
            this._absolutePath,
            themeJSON.screenshot_path
          );
          if (!fs.existsSync(absoluteScreenshotPath)) {
            validationErrors.push(
              this.getError(this.errors.MISSING_SCREENSHOT, themeJSONFile)
            );
          }
        }
      }
    }

    return validationErrors;
  }
}

module.exports = new ThemeValidator({
  name: 'Theme config',
  key: VALIDATOR_KEYS.themeConfig,
});

const { walk } = require('@hubspot/cli-lib/lib/walk');
const { ERROR_SEVERITY } = require('../validationErrorUtils');

const VALIDATOR_NAME = 'ThemeConfigValidator';
const THEME_JSON_REGEX = new RegExp(/theme\.json+$/);

// Validate that the theme contains a theme.json file
async function themeConfigValidator(absoluteThemePath) {
  return walk(absoluteThemePath, true).then(topLevelFolderFiles => {
    let validationErrors = [];

    const hasThemeJSONFile = topLevelFolderFiles.find(fileName => {
      return THEME_JSON_REGEX.test(fileName);
    });

    if (!hasThemeJSONFile) {
      validationErrors.push({
        validator: VALIDATOR_NAME,
        error: 'Missing a theme.json file',
        severity: ERROR_SEVERITY.FATAL,
      });
    }

    return validationErrors;
  });
}

module.exports = { validate: themeConfigValidator };

const { read } = require('@hubspot/cli-lib/lib/read');
const { ERROR_SEVERITY } = require('../constants');

const VALIDATOR_NAME = 'ThemeConfigValidator';
const THEME_JSON_REGEX = new RegExp(/theme\.json+$/);

//TODO branden do we need this validation? Should we also look at the fields in
// the theme.json file?

// Validate that the theme contains a theme.json file
async function themeConfigValidator(absoluteThemePath) {
  return read(absoluteThemePath).then(topLevelFolderFiles => {
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

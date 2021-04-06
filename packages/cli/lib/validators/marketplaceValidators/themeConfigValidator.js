const fs = require('fs');

const { VALIDATION_RESULT } = require('../constants');

const VALIDATOR_NAME = 'ThemeConfigValidator';
const THEME_JSON_REGEX = new RegExp(/^theme\.json$/);

// Validate that the theme contains a theme.json file
function themeConfigValidator(absoluteThemePath, files) {
  let validationErrors = [];
  const themeJSONFile = files.find(filePath => {
    // Check for theme.json at the theme root
    const fileName = filePath.replace(`${absoluteThemePath}/`, '');
    return THEME_JSON_REGEX.test(fileName);
  });

  if (!themeJSONFile) {
    validationErrors.push({
      validator: VALIDATOR_NAME,
      error: 'Missing a theme.json file',
      result: VALIDATION_RESULT.FATAL,
    });
  } else {
    let themeJSON;

    try {
      themeJSON = JSON.parse(fs.readFileSync(themeJSONFile));
    } catch (err) {
      validationErrors.push({
        validator: VALIDATOR_NAME,
        error: 'Invalid json in theme.json file',
        result: VALIDATION_RESULT.FATAL,
      });
    }

    if (themeJSON) {
      if (!themeJSON.label) {
        validationErrors.push({
          validator: VALIDATOR_NAME,
          error: 'The theme.json file must have a "label" field',
          result: VALIDATION_RESULT.FATAL,
        });
      }
    }
  }

  return validationErrors;
}

module.exports = {
  name: VALIDATOR_NAME,
  validate: themeConfigValidator,
};

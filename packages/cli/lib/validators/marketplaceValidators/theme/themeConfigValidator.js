const fs = require('fs');

const { VALIDATION_RESULT } = require('../constants');

const VALIDATOR_NAME = 'ThemeConfigValidator';

// Validate that the theme contains a theme.json file
function themeConfigValidator(absoluteThemePath, files) {
  let validationErrors = [];
  const themeJSONFile = files.find(filePath => {
    // Check for theme.json at the theme root
    const fileName = filePath.replace(`${absoluteThemePath}/`, '');
    return fileName === 'theme.json';
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
        meta: {
          file: themeJSONFile,
        },
      });
    }

    if (themeJSON) {
      if (!themeJSON.label) {
        validationErrors.push({
          validator: VALIDATOR_NAME,
          error: 'The theme.json file must have a "label" field',
          result: VALIDATION_RESULT.FATAL,
          meta: {
            file: themeJSONFile,
          },
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

const fs = require('fs');

const { read } = require('@hubspot/cli-lib/lib/read');

const { ERROR_SEVERITY } = require('../constants');

const VALIDATOR_NAME = 'ThemeConfigValidator';
const THEME_JSON_REGEX = new RegExp(/theme\.json+$/);

// Validate that the theme contains a theme.json file
async function themeConfigValidator(absoluteThemePath) {
  return read(absoluteThemePath).then(topLevelFolderFiles => {
    let validationErrors = [];

    const themeJSONFile = topLevelFolderFiles.find(fileName => {
      return THEME_JSON_REGEX.test(fileName);
    });

    if (!themeJSONFile) {
      validationErrors.push({
        validator: VALIDATOR_NAME,
        error: 'Missing a theme.json file',
        severity: ERROR_SEVERITY.FATAL,
      });
    } else {
      let themeJSON;

      try {
        themeJSON = JSON.parse(fs.readFileSync(themeJSONFile));
      } catch (err) {
        //TODO branden show more useful error here?
        validationErrors.push({
          validator: VALIDATOR_NAME,
          error: 'Invalid theme.json file',
          severity: ERROR_SEVERITY.FATAL,
        });
      }

      if (themeJSON) {
        if (!themeJSON.label) {
          validationErrors.push({
            validator: VALIDATOR_NAME,
            error: 'The theme.json file must have a "label" field',
            severity: ERROR_SEVERITY.FATAL,
          });
        }
      }
    }

    return validationErrors;
  });
}

module.exports = { validate: themeConfigValidator };

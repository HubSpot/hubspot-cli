const inquirer = require('inquirer');

const { STRING_WITH_NO_SPACES_REGEX } = require('@hubspot/cms-lib/lib/regex');

const FUNCTIONS_FOLDER_PROMPT = {
  name: 'functionsFolder',
  message: 'Name of the folder where your function will be created',
  validate(val) {
    if (typeof val !== 'string') {
      return 'You entered an invalid name. Please try again.';
    } else if (!val.length) {
      return 'The name may not be blank. Please try again.';
    } else if (!STRING_WITH_NO_SPACES_REGEX.test(val)) {
      return 'The name may not contain spaces. Please try again.';
    }
    return true;
  },
};
const ENDPOINT_PATH_PROMPT = {
  name: 'endpointPath',
  message: 'Path portion of the URL created for the function',
  validate(val) {
    if (typeof val !== 'string') {
      return 'You entered an invalid name. Please try again.';
    } else if (!val.length) {
      return 'The name may not be blank. Please try again.';
    } else if (!STRING_WITH_NO_SPACES_REGEX.test(val)) {
      return 'The name may not contain spaces. Please try again.';
    }
    return true;
  },
};
const ENDPOINT_METHOD_PROMPT = {
  type: 'list',
  name: 'endpointMethod',
  message: 'Select the HTTP method for the endpoint',
  default: 'GET',
  choices: ['DELETE', 'GET', 'PATCH', 'POST', 'PUT'],
};
const FUNCTION_FILENAME_PROMPT = {
  name: 'filename',
  message: 'Name of the JavaScript file for your function',
  validate(val) {
    if (typeof val !== 'string') {
      return 'You entered an invalid name. Please try again.';
    } else if (!val.length) {
      return 'The name may not be blank. Please try again.';
    } else if (!STRING_WITH_NO_SPACES_REGEX.test(val)) {
      return 'The name may not contain spaces. Please try again.';
    }
    return true;
  },
};

function createFunctionPrompt() {
  const prompt = inquirer.createPromptModule();
  return prompt([
    FUNCTIONS_FOLDER_PROMPT,
    FUNCTION_FILENAME_PROMPT,
    ENDPOINT_METHOD_PROMPT,
    ENDPOINT_PATH_PROMPT,
  ]);
}
module.exports = {
  createFunctionPrompt,
};

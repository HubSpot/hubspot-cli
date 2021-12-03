const { promptUser } = require('./promptUtils');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const { STRING_WITH_NO_SPACES_REGEX } = require('../regex');

const i18nKey = 'cli.lib.prompts.createFunctionPrompt';

const FUNCTIONS_FOLDER_PROMPT = {
  name: 'functionsFolder',
  message: i18n(`${i18nKey}.enterFolder`),
  validate(val) {
    if (typeof val !== 'string') {
      return i18n(`${i18nKey}.errors.invalid`);
    } else if (!val.length) {
      return i18n(`${i18nKey}.errors.blank`);
    } else if (!STRING_WITH_NO_SPACES_REGEX.test(val)) {
      return i18n(`${i18nKey}.errors.space`);
    }
    return true;
  },
};
const ENDPOINT_PATH_PROMPT = {
  name: 'endpointPath',
  message: i18n(`${i18nKey}.enterEndpointPath`),
  validate(val) {
    if (typeof val !== 'string') {
      return i18n(`${i18nKey}.errors.invalid`);
    } else if (!val.length) {
      return i18n(`${i18nKey}.errors.blank`);
    } else if (!STRING_WITH_NO_SPACES_REGEX.test(val)) {
      return i18n(`${i18nKey}.errors.space`);
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
  message: i18n(`${i18nKey}.selectEndpointMethod`),
  validate(val) {
    if (typeof val !== 'string') {
      return i18n(`${i18nKey}.errors.invalid`);
    } else if (!val.length) {
      return i18n(`${i18nKey}.errors.blank`);
    } else if (!STRING_WITH_NO_SPACES_REGEX.test(val)) {
      return i18n(`${i18nKey}.errors.space`);
    }
    return true;
  },
};

function createFunctionPrompt() {
  return promptUser([
    FUNCTIONS_FOLDER_PROMPT,
    FUNCTION_FILENAME_PROMPT,
    ENDPOINT_METHOD_PROMPT,
    ENDPOINT_PATH_PROMPT,
  ]);
}

module.exports = {
  createFunctionPrompt,
};

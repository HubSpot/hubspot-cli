const inquirer = require('inquirer');
const {
  AUTH_METHODS,
  OAUTH_SCOPES,
  DEFAULT_OAUTH_SCOPES,
} = require('@hubspot/cms-lib/lib/constants');
const { API_KEY_REGEX, STRING_WITH_NO_SPACES_REGEX } = require('./regex');

const promptUser = async promptConfig => {
  const prompt = inquirer.createPromptModule();
  return prompt(promptConfig);
};

const PORTAL_ID = {
  name: 'portalId',
  message:
    'Enter the portal ID for your account (the number under the DOMAIN column at https://app.hubspot.com/myaccounts-beta):',
  type: 'number',
  validate(val) {
    if (!Number.isNaN(val) && val > 0) {
      return true;
    }
    return 'You did not enter a valid portal ID. Please try again.';
  },
};

const CLIENT_ID = {
  name: 'clientId',
  message: 'Enter your OAuth2 client ID:',
  validate(val) {
    if (typeof val !== 'string' || val.length !== 36) {
      return 'The OAuth2 client ID must be 36 characters long. Please try again.';
    }
    return true;
  },
};

const CLIENT_SECRET = {
  name: 'clientSecret',
  message: 'Enter your OAuth2 client secret:',
  validate(val) {
    if (typeof val !== 'string' || val.length !== 36) {
      return 'The OAuth2 client secret must be 36 characters long. Please try again.';
    } else if (val[0] === '*') {
      return 'Please copy the actual OAuth2 client secret rather than the asterisks that mask it.';
    }
    return true;
  },
};

const PORTAL_NAME = {
  name: 'name',
  message: 'Enter a unique name to reference your account:',
  validate(val) {
    if (typeof val !== 'string' || !val.length) {
      return 'The name may not be blank. Please try again.';
    } else if (!STRING_WITH_NO_SPACES_REGEX.test(val)) {
      return 'The name may not contain spaces. Please try again.';
    }
    return true;
  },
};

const PORTAL_API_KEY = {
  name: 'apiKey',
  message:
    'Enter the API key for your portal (found at https://app.hubspot.com/l/api-key):',
  validate(val) {
    if (!API_KEY_REGEX.test(val)) {
      return 'You did not enter a valid API key. Please try again.';
    }
    return true;
  },
};

const AUTH_METHOD = {
  type: 'rawlist',
  name: 'authMethod',
  message: 'Choose the authentication method',
  default: 0,
  choices: Object.keys(AUTH_METHODS).map(method => AUTH_METHODS[method]),
};

const SCOPES = {
  type: 'checkbox',
  name: 'scopes',
  message:
    'Select access scopes (see https://developers.hubspot.com/docs/methods/oauth2/initiate-oauth-integration#scopes)',
  default: DEFAULT_OAUTH_SCOPES,
  choices: OAUTH_SCOPES,
};

const OAUTH_FLOW = [PORTAL_ID, CLIENT_ID, CLIENT_SECRET, SCOPES];
const API_KEY_FLOW = [PORTAL_NAME, PORTAL_ID, PORTAL_API_KEY];

module.exports = {
  promptUser,
  PORTAL_API_KEY,
  PORTAL_ID,
  PORTAL_NAME,
  CLIENT_ID,
  CLIENT_SECRET,
  AUTH_METHOD,
  SCOPES,
  OAUTH_FLOW,
  API_KEY_FLOW,
};

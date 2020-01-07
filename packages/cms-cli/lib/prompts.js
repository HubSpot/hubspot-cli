const inquirer = require('inquirer');
const {
  AUTH_METHODS,
  OAUTH_SCOPES,
  DEFAULT_OAUTH_SCOPES,
} = require('@hubspot/cms-lib/lib/constants');
const { API_KEY_REGEX } = require('./regex');

const promptUser = async promptConfig => {
  const prompt = inquirer.createPromptModule();
  return prompt(promptConfig);
};

const PORTAL_ID = {
  name: 'portalId',
  message: 'Enter the HubSpot CMS portal ID:',
  type: 'number',
  validate(val) {
    if (!Number.isNaN(val) && val > 0) {
      return true;
    }
    return 'A HubSpot portal ID must be provided.';
  },
};

const CLIENT_ID = {
  name: 'clientId',
  message: 'Enter your OAuth2 client ID:',
  validate(val) {
    if (typeof val !== 'string' || val.length !== 36) {
      return 'The OAuth2 client ID is 36 characters long. Please try again.';
    }
    return true;
  },
};

const CLIENT_SECRET = {
  name: 'clientSecret',
  message: 'Enter your OAuth2 client secret:',
  validate(val) {
    if (typeof val !== 'string' || val.length !== 36) {
      return 'The OAuth2 client secret is 36 characters long. Please try again.';
    } else if (val[0] === '*') {
      return 'Please copy actual OAuth2 client secret not the asterisks used to hide it.';
    }
    return true;
  },
};

const PORTAL_NAME = {
  name: 'name',
  message: 'Enter a name for your portal:',
  validate(val) {
    if (typeof val !== 'string' || !val.length) {
      return 'Portal name cannot be blank. Please try again.';
    }
    return true;
  },
};

const PORTAL_API_KEY = {
  name: 'apiKey',
  message: 'Enter the API key for your portal:',
  validate(val) {
    if (!API_KEY_REGEX.test(val)) {
      return 'This is not a valid portal API key. Please try again.';
    }
    return true;
  },
};

const AUTH_METHOD = {
  type: 'list',
  name: 'authMethod',
  message: 'Choose authentication method',
  default: AUTH_METHODS.oauth.value,
  choices: Object.keys(AUTH_METHODS).map(method => AUTH_METHODS[method]),
};

const SCOPES = {
  type: 'checkbox',
  name: 'scopes',
  message: 'Select scopes',
  default: DEFAULT_OAUTH_SCOPES,
  choices: OAUTH_SCOPES,
};

const OAUTH_FLOW = [PORTAL_ID, CLIENT_ID, CLIENT_SECRET];
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

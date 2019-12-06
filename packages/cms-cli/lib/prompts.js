const { API_KEY_REGEX, CAPITAL_LETTER_REGEX } = require('./regex');
const { AUTH_METHODS } = require('@hubspot/cms-lib/lib/constants');

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
  default: AUTH_METHODS.oauth,
  choices: Object.keys(AUTH_METHODS).map(method => {
    const authMethod = AUTH_METHODS[method];
    return {
      value: authMethod,
      name: authMethod
        .split(CAPITAL_LETTER_REGEX)
        .join(' ')
        .toLowerCase(),
    };
  }),
};

module.exports = {
  PORTAL_API_KEY,
  PORTAL_ID,
  PORTAL_NAME,
  CLIENT_ID,
  CLIENT_SECRET,
  AUTH_METHOD,
};

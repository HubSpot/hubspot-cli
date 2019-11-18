const API_KEY_REGEX = new RegExp(
  '^([a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12})',
  'i'
);

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
  name: 'portalName',
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

module.exports = {
  PORTAL_API_KEY,
  PORTAL_ID,
  PORTAL_NAME,
  CLIENT_ID,
  CLIENT_SECRET,
};

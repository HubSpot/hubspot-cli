const inquirer = require('inquirer');
const open = require('open');
const {
  OAUTH_SCOPES,
  DEFAULT_OAUTH_SCOPES,
} = require('@hubspot/cli-lib/lib/constants');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cli-lib/lib/urls');
const { logger } = require('@hubspot/cli-lib/logger');
const { API_KEY_REGEX, STRING_WITH_NO_SPACES_REGEX } = require('./regex');

const promptUser = async promptConfig => {
  const prompt = inquirer.createPromptModule();
  return prompt(promptConfig);
};

/**
 * Displays notification to user that we are about to open the browser,
 * then opens their browser to the personal-access-key shortlink
 */
const personalAccessKeyPrompt = async ({ env } = {}) => {
  const websiteOrigin = getHubSpotWebsiteOrigin(env);
  const url = `${websiteOrigin}/l/personal-access-key`;
  if (process.env.BROWSER !== 'none') {
    await promptUser([PERSONAL_ACCESS_KEY_BROWSER_OPEN_PREP]);
    open(url, { url: true });
  }

  logger.log(`Opening ${url} in your web browser`);
  const { personalAccessKey } = await promptUser(PERSONAL_ACCESS_KEY);

  return {
    personalAccessKey,
    env,
  };
};

const ACCOUNT_ID = {
  name: 'accountId',
  message:
    'Enter the account ID for your account (the number under the DOMAIN column at https://app.hubspot.com/myaccounts-beta ):',
  type: 'number',
  validate(val) {
    if (!Number.isNaN(val) && val > 0) {
      return true;
    }
    return 'You did not enter a valid account ID. Please try again.';
  },
};

const CLIENT_ID = {
  name: 'clientId',
  message: 'Enter your OAuth2 client ID:',
  validate(val) {
    if (typeof val !== 'string') {
      return 'You entered an invalid OAuth2 client ID. Please try again.';
    } else if (val.length !== 36) {
      return 'The OAuth2 client ID must be 36 characters long. Please try again.';
    }
    return true;
  },
};

const CLIENT_SECRET = {
  name: 'clientSecret',
  message: 'Enter your OAuth2 client secret:',
  validate(val) {
    if (typeof val !== 'string') {
      return 'You entered an invalid OAuth2 client secret. Please try again.';
    } else if (val.length !== 36) {
      return 'The OAuth2 client secret must be 36 characters long. Please try again.';
    } else if (val[0] === '*') {
      return 'Please copy the actual OAuth2 client secret rather than the asterisks that mask it.';
    }
    return true;
  },
};

const ACCOUNT_NAME = {
  name: 'name',
  message: 'Enter a unique name to reference your account:',
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

const ACCOUNT_API_KEY = {
  name: 'apiKey',
  message:
    'Enter the API key for your account (found at https://app.hubspot.com/l/api-key):',
  validate(val) {
    if (!API_KEY_REGEX.test(val)) {
      return 'You did not enter a valid API key. Please try again.';
    }
    return true;
  },
};

const PERSONAL_ACCESS_KEY_BROWSER_OPEN_PREP = {
  name: 'personalAcessKeyBrowserOpenPrep',
  message:
    "When you're ready, we'll open a secure page in your default browser where you can view and copy your personal access key, which you'll need to complete the next step.\n<Press enter to open the page and generate your personal access key>",
};

const PERSONAL_ACCESS_KEY = {
  name: 'personalAccessKey',
  message: 'Enter your personal access key:',
  validate(val) {
    if (typeof val !== 'string') {
      return 'You did not enter a valid access key. Please try again.';
    } else if (val[0] === '•') {
      return 'Please copy the actual access key rather than the bullets that mask it.';
    }
    return true;
  },
};

const SCOPES = {
  type: 'checkbox',
  name: 'scopes',
  message:
    'Select access scopes (see https://developers.hubspot.com/docs/methods/oauth2/initiate-oauth-integration#scopes)',
  default: DEFAULT_OAUTH_SCOPES,
  choices: OAUTH_SCOPES,
};

const OAUTH_FLOW = [ACCOUNT_NAME, ACCOUNT_ID, CLIENT_ID, CLIENT_SECRET, SCOPES];
const API_KEY_FLOW = [ACCOUNT_NAME, ACCOUNT_ID, ACCOUNT_API_KEY];

const folderOverwritePrompt = folderName => {
  return promptUser({
    type: 'confirm',
    name: 'overwrite',
    message: `The folder with name '${folderName}' already exists. Overwrite?`,
    default: false,
  });
};

module.exports = {
  folderOverwritePrompt,
  promptUser,
  personalAccessKeyPrompt,
  CLIENT_ID,
  CLIENT_SECRET,
  ACCOUNT_API_KEY,
  ACCOUNT_ID,
  ACCOUNT_NAME,
  SCOPES,
  PERSONAL_ACCESS_KEY,

  // Flows
  API_KEY_FLOW,
  OAUTH_FLOW,
};

const open = require('open');
const {
  OAUTH_SCOPES,
  DEFAULT_OAUTH_SCOPES,
} = require('@hubspot/cli-lib/lib/constants');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cli-lib/lib/urls');
const { logger } = require('@hubspot/cli-lib/logger');
const { API_KEY_REGEX, STRING_WITH_NO_SPACES_REGEX } = require('./regex');
const { promptUser } = require('./promptUtils');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.lib.prompts.personalAccessKeyPrompt';

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

  logger.log(i18n(`${i18nKey}.logs.openingWebBrowser`, { url }));
  const { personalAccessKey } = await promptUser(PERSONAL_ACCESS_KEY);

  return {
    personalAccessKey,
    env,
  };
};

const ACCOUNT_ID = {
  name: 'accountId',
  message: i18n(`${i18nKey}.enterAccountId`),
  type: 'number',
  validate(val) {
    if (!Number.isNaN(val) && val > 0) {
      return true;
    }
    return i18n(`${i18nKey}.errors.invalidAccountId`);
  },
};

const CLIENT_ID = {
  name: 'clientId',
  message: i18n(`${i18nKey}.enterClientId`),
  validate(val) {
    if (typeof val !== 'string') {
      return i18n(`${i18nKey}.errors.invalidOauthClientId`);
    } else if (val.length !== 36) {
      return i18n(`${i18nKey}.errors.invalidOauthClientIdLength`);
    }
    return true;
  },
};

const CLIENT_SECRET = {
  name: 'clientSecret',
  message: i18n(`${i18nKey}.enterClientSecret`),
  validate(val) {
    if (typeof val !== 'string') {
      return i18n(`${i18nKey}.errors.invalidOauthClientSecret`);
    } else if (val.length !== 36) {
      return i18n(`${i18nKey}.errors.invalidOauthClientSecretLength`);
    } else if (val[0] === '*') {
      return i18n(`${i18nKey}.errors.invalidOauthClientSecretCopy`);
    }
    return true;
  },
};

const ACCOUNT_NAME = {
  name: 'name',
  message: i18n(`${i18nKey}.enterAccountName`),
  validate(val) {
    if (typeof val !== 'string') {
      return i18n(`${i18nKey}.errors.invalidName`);
    } else if (!val.length) {
      return i18n(`${i18nKey}.errors.nameRequired`);
    } else if (!STRING_WITH_NO_SPACES_REGEX.test(val)) {
      return i18n(`${i18nKey}.errors.spacesInName`);
    }
    return true;
  },
};

const ACCOUNT_API_KEY = {
  name: 'apiKey',
  message: i18n(`${i18nKey}.enterApiKey`),
  validate(val) {
    if (!API_KEY_REGEX.test(val)) {
      return i18n(`${i18nKey}.errors.invalidAPIKey`);
    }
    return true;
  },
};

const PERSONAL_ACCESS_KEY_BROWSER_OPEN_PREP = {
  name: 'personalAcessKeyBrowserOpenPrep',
  message: i18n(`${i18nKey}.personalAccessKeyBrowserOpenPrep`),
};

const PERSONAL_ACCESS_KEY = {
  name: 'personalAccessKey',
  message: i18n(`${i18nKey}.enterPersonalAccessKey`),
  validate(val) {
    if (typeof val !== 'string') {
      return i18n(`${i18nKey}.errors.invalidPersonalAccessKey`);
    } else if (val[0] === '•') {
      return i18n(`${i18nKey}.errors.invalidPersonalAccessKeyCopy`);
    }
    return true;
  },
};

const SCOPES = {
  type: 'checkbox',
  name: 'scopes',
  message: i18n(`${i18nKey}.selectScopes`),
  default: DEFAULT_OAUTH_SCOPES,
  choices: OAUTH_SCOPES,
};

const OAUTH_FLOW = [ACCOUNT_NAME, ACCOUNT_ID, CLIENT_ID, CLIENT_SECRET, SCOPES];
const API_KEY_FLOW = [ACCOUNT_NAME, ACCOUNT_ID, ACCOUNT_API_KEY];

module.exports = {
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

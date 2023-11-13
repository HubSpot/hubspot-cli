const open = require('open');
const {
  OAUTH_SCOPES,
  DEFAULT_OAUTH_SCOPES,
} = require('@hubspot/cli-lib/lib/constants');
const { deleteEmptyConfigFile } = require('@hubspot/local-dev-lib/config');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const { logger } = require('@hubspot/cli-lib/logger');
const { promptUser } = require('./promptUtils');
const { accountNamePrompt } = require('./enterAccountNamePrompt');
const { i18n } = require('../lang');
const { uiInfoSection } = require('../ui');
const { EXIT_CODES } = require('../enums/exitCodes');

const i18nKey = 'cli.lib.prompts.personalAccessKeyPrompt';

/**
 * Displays notification to user that we are about to open the browser,
 * then opens their browser to the personal-access-key shortlink
 */
const personalAccessKeyPrompt = async ({ env, account } = {}) => {
  const websiteOrigin = getHubSpotWebsiteOrigin(env);
  let url = `${websiteOrigin}/l/personal-access-key`;
  if (process.env.BROWSER !== 'none') {
    uiInfoSection(i18n(`${i18nKey}.personalAccessKeySetupTitle`), () => {
      logger.log(i18n(`${i18nKey}.personalAccessKeyBrowserOpenPrep`));
    });
    if (account) {
      url = `${websiteOrigin}/personal-access-key/${account}`;
    }
    const { personalAcessKeyBrowserOpenPrep: shouldOpen } = await promptUser([
      PERSONAL_ACCESS_KEY_BROWSER_OPEN_PREP,
    ]);
    if (shouldOpen) {
      open(url, { url: true });
    } else {
      deleteEmptyConfigFile();
      process.exit(EXIT_CODES.SUCCESS);
    }
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

const PERSONAL_ACCESS_KEY_BROWSER_OPEN_PREP = {
  name: 'personalAcessKeyBrowserOpenPrep',
  type: 'confirm',
  message: i18n(`${i18nKey}.personalAccessKeyBrowserOpenPrompt`),
};

const PERSONAL_ACCESS_KEY = {
  name: 'personalAccessKey',
  message: i18n(`${i18nKey}.enterPersonalAccessKey`),
  transformer: val => {
    if (!val) return val;
    let res = '';
    for (let i = 0; i < val.length; i++) {
      res += '*';
    }
    return res;
  },
  validate(val) {
    if (!val || typeof val !== 'string') {
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

const OAUTH_FLOW = [
  accountNamePrompt(),
  ACCOUNT_ID,
  CLIENT_ID,
  CLIENT_SECRET,
  SCOPES,
];

module.exports = {
  personalAccessKeyPrompt,
  CLIENT_ID,
  CLIENT_SECRET,
  ACCOUNT_ID,
  SCOPES,
  PERSONAL_ACCESS_KEY,
  // Flows
  OAUTH_FLOW,
};

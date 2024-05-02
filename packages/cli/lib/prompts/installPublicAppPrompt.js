const open = require('open');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');
const { EXIT_CODES } = require('../enums/exitCodes');

const i18nKey = 'lib.prompts.installPublicAppPrompt';

const installPublicAppPrompt = async (env, clientId, scopes, redirectUrls) => {
  logger.log(i18n(`${i18nKey}.explanation`));

  const { shouldOpenBrowser } = await promptUser({
    name: 'shouldOpenBrowser',
    type: 'confirm',
    message: i18n(`${i18nKey}.prompt`),
  });

  if (!shouldOpenBrowser) {
    logger.log(i18n(`${i18nKey}.decline`));
    process.exit(EXIT_CODES.SUCCESS);
  }

  const websiteOrigin = getHubSpotWebsiteOrigin(env);

  const url =
    `${websiteOrigin}/oauth/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&redirect_uri=${encodeURIComponent(redirectUrls)}`;

  open(url);
};

module.exports = { installPublicAppPrompt };

const open = require('open');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');
const { EXIT_CODES } = require('../enums/exitCodes');

const i18nKey = 'lib.prompts.installPublicAppPrompt';

const installPublicAppPrompt = async (
  env,
  targetAccountId,
  clientId,
  scopes,
  redirectUrls,
  isReinstall = false
) => {
  logger.log('');
  if (isReinstall) {
    logger.log(i18n(`${i18nKey}.reinstallExplanation`));
  } else {
    logger.log(i18n(`${i18nKey}.explanation`));
  }

  const { shouldOpenBrowser } = await promptUser({
    name: 'shouldOpenBrowser',
    type: 'confirm',
    message: i18n(
      isReinstall ? `${i18nKey}.reinstallPrompt` : `${i18nKey}.prompt`
    ),
  });

  if (!isReinstall && !shouldOpenBrowser) {
    logger.log(i18n(`${i18nKey}.decline`));
    process.exit(EXIT_CODES.SUCCESS);
  } else if (!shouldOpenBrowser) {
    return;
  }

  const websiteOrigin = getHubSpotWebsiteOrigin(env);

  const url =
    `${websiteOrigin}/oauth/${targetAccountId}/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&scope=${encodeURIComponent(scopes.join(' '))}` +
    `&redirect_uri=${encodeURIComponent(redirectUrls[0])}`;

  open(url);
};

module.exports = { installPublicAppPrompt };

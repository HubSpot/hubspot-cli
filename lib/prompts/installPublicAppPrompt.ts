import open from 'open';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { logger } from '@hubspot/local-dev-lib/logger';
import { promptUser } from './promptUtils';
import { i18n } from '../lang';
import { EXIT_CODES } from '../enums/exitCodes';

const i18nKey = 'lib.prompts.installPublicAppPrompt';

export async function installPublicAppPrompt(
  env: string,
  targetAccountId: number,
  clientId: number,
  scopes: string[],
  redirectUrls: string[],
  isReinstall = false
): Promise<void> {
  logger.log('');
  if (isReinstall) {
    logger.log(i18n(`${i18nKey}.reinstallExplanation`));
  } else {
    logger.log(i18n(`${i18nKey}.explanation`));
  }

  const { shouldOpenBrowser } = await promptUser<{
    shouldOpenBrowser: boolean;
  }>({
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
}

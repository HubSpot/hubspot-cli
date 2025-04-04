import open from 'open';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { logger } from '@hubspot/local-dev-lib/logger';
import { promptUser } from './promptUtils';
import { i18n } from '../lang';
import { EXIT_CODES } from '../enums/exitCodes';


export async function installPublicAppPrompt(
  env: string,
  targetAccountId: number,
  clientId: string,
  scopes: string[],
  redirectUrls: string[],
  isReinstall = false
): Promise<void> {
  logger.log('');
  if (isReinstall) {
    logger.log(i18n(`lib.prompts.installPublicAppPrompt.reinstallExplanation`));
  } else {
    logger.log(i18n(`lib.prompts.installPublicAppPrompt.explanation`));
  }

  const { shouldOpenBrowser } = await promptUser<{
    shouldOpenBrowser: boolean;
  }>({
    name: 'shouldOpenBrowser',
    type: 'confirm',
    message: i18n(
      isReinstall ? `lib.prompts.installPublicAppPrompt.reinstallPrompt` : `lib.prompts.installPublicAppPrompt.prompt`
    ),
  });

  if (!isReinstall && !shouldOpenBrowser) {
    logger.log(i18n(`lib.prompts.installPublicAppPrompt.decline`));
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

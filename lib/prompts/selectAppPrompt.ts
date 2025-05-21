import { logger } from '@hubspot/local-dev-lib/logger';
import { fetchPublicAppsForPortal } from '@hubspot/local-dev-lib/api/appsDev';
import { PublicApp } from '@hubspot/local-dev-lib/types/Apps';
import { debugError } from '../errorHandlers/index';
import { lib } from '../../lang/en';
import { EXIT_CODES } from '../enums/exitCodes';
import { listPrompt } from '../prompts/promptUtils';

export async function selectAppPrompt(
  accountId: number,
  appId?: number
): Promise<PublicApp> {
  let availableApps: PublicApp[] = [];

  try {
    const appsResponse = await fetchPublicAppsForPortal(accountId);
    if (appsResponse.data.results) {
      availableApps = appsResponse.data.results;
    }
  } catch (err) {
    debugError(err);
  }

  if (availableApps.length === 0) {
    logger.error(lib.prompts.selectAppPrompt.errors.noApps);
    process.exit(EXIT_CODES.ERROR);
  }

  if (appId) {
    const targetApp = availableApps.find(app => app.id === appId);
    if (targetApp) {
      return targetApp;
    } else {
      logger.error(lib.prompts.selectAppPrompt.errors.invalidAppId);
    }
  }

  const appPromptValue = await listPrompt(
    lib.prompts.selectAppPrompt.selectAppId,
    {
      choices: availableApps.map(app => ({
        name: `${app.name} (${app.id})`,
        value: app,
      })),
    }
  );

  if (!appPromptValue) {
    process.exit(EXIT_CODES.ERROR);
  }

  return appPromptValue;
}

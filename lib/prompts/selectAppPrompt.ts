import { logger } from '@hubspot/local-dev-lib/logger';
import { fetchPublicAppsForPortal } from '@hubspot/local-dev-lib/api/appsDev';
import { PublicApp } from '@hubspot/local-dev-lib/types/Apps';
import { debugError } from '../errorHandlers/index';
import { lib } from '../../lang/en';
import { listPrompt } from '../prompts/promptUtils';

export async function selectAppPrompt(
  accountId: number,
  appId?: number
): Promise<PublicApp | null> {
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
    return null;
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

  return appPromptValue;
}

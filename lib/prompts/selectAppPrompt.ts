import { uiLogger } from '../ui/logger.js';
import { fetchPublicAppsForPortal } from '@hubspot/local-dev-lib/api/appsDev';
import { PublicApp } from '@hubspot/local-dev-lib/types/Apps';
import { debugError } from '../errorHandlers/index.js';
import { lib } from '../../lang/en.js';
import { listPrompt } from '../prompts/promptUtils.js';

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
    uiLogger.error(lib.prompts.selectAppPrompt.errors.noApps);
    return null;
  }

  if (appId) {
    const targetApp = availableApps.find(app => app.id === appId);
    if (targetApp) {
      return targetApp;
    } else {
      uiLogger.error(lib.prompts.selectAppPrompt.errors.invalidAppId);
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

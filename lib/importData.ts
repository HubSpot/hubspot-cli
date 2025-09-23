import {
  getAccountConfig,
  getAccountId,
  getEnv,
} from '@hubspot/local-dev-lib/config';
import { createImport } from '@hubspot/local-dev-lib/api/crm';
import { ImportRequest } from '@hubspot/local-dev-lib/types/Crm';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';

import { importDataTestAccountSelectPrompt } from './prompts/importDataTestAccountSelectPrompt.js';
import { lib } from '../lang/en.js';
import {
  isAppDeveloperAccount,
  isDeveloperTestAccount,
  isStandardAccount,
} from './accountTypes.js';
import { uiLogger } from './ui/logger.js';

export async function handleImportData(
  targetAccountId: number,
  dataFileNames: string[],
  importRequest: ImportRequest
) {
  try {
    const baseUrl = getHubSpotWebsiteOrigin(getEnv());
    const response = await createImport(
      targetAccountId,
      importRequest,
      dataFileNames
    );
    const importId = response.data.id;
    uiLogger.info(
      lib.importData.viewImportLink(baseUrl, targetAccountId, importId)
    );
  } catch (error) {
    uiLogger.error(lib.importData.errors.failedToImportData);
    throw error;
  }
}

export async function handleTargetTestAccountSelectionFlow(
  derivedAccountId: number,
  userProvidedAccount: string | number | undefined
): Promise<number> {
  let targetAccountId: number | null = null;

  if (userProvidedAccount) {
    targetAccountId = getAccountId(userProvidedAccount);
  }

  // Only allow users to pass in test accounts
  if (targetAccountId) {
    const testAccount = getAccountConfig(targetAccountId!);

    if (!testAccount || !isDeveloperTestAccount(testAccount)) {
      throw new Error(lib.importData.errors.notDeveloperTestAccount);
    }
  } else {
    const targetProjectAccountConfig = getAccountConfig(derivedAccountId);

    if (!targetProjectAccountConfig) {
      throw new Error(lib.importData.errors.noAccountConfig(derivedAccountId));
    }

    if (isDeveloperTestAccount(targetProjectAccountConfig)) {
      targetAccountId = derivedAccountId;
    } else if (
      !isStandardAccount(targetProjectAccountConfig) &&
      !isAppDeveloperAccount(targetProjectAccountConfig)
    ) {
      throw new Error(
        lib.importData.errors.incorrectAccountType(derivedAccountId)
      );
    } else {
      const { selectedAccountId } =
        await importDataTestAccountSelectPrompt(derivedAccountId);
      targetAccountId = selectedAccountId;
    }
  }

  return targetAccountId;
}

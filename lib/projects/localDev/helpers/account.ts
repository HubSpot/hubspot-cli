import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { Environment } from '@hubspot/local-dev-lib/types/Accounts';
import { isMissingScopeError } from '@hubspot/local-dev-lib/errors/index';
import { DeveloperTestAccount } from '@hubspot/local-dev-lib/types/developerTestAccounts.js';
import { PERSONAL_ACCESS_KEY_AUTH_METHOD } from '@hubspot/local-dev-lib/constants/auth';
import { getSandboxUsageLimits } from '@hubspot/local-dev-lib/api/sandboxHubs';

import { uiLogger } from '../../../ui/logger.js';
import { lib } from '../../../../lang/en.js';
import { validateSandboxUsageLimits } from '../../../sandboxes.js';
import { logError } from '../../../errorHandlers/index.js';
import { hubspotAccountNamePrompt } from '../../../prompts/accountNamePrompt.js';
import { trackCommandMetadataUsage } from '../../../usageTracking.js';
import { validateDevTestAccountUsageLimits } from '../../../developerTestAccounts.js';
import {
  buildDeveloperTestAccount,
  saveAccountToConfig,
  buildV2Sandbox,
} from '../../../buildAccount.js';
import { debugError } from '../../../errorHandlers/index.js';
import { listPrompt } from '../../../prompts/promptUtils.js';
import { confirmUseExistingDeveloperTestAccountPrompt } from '../../../prompts/projectDevTargetAccountPrompt.js';

// Create a new sandbox and return its accountId
export async function createSandboxForLocalDev(
  accountId: number,
  accountConfig: HubSpotConfigAccount,
  env: Environment
): Promise<number> {
  try {
    await validateSandboxUsageLimits(
      accountConfig,
      HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
      env
    );
  } catch (err) {
    if (isMissingScopeError(err)) {
      uiLogger.error(lib.sandbox.create.developer.failure.scopes.message);
      const websiteOrigin = getHubSpotWebsiteOrigin(env);
      const url = `${websiteOrigin}/personal-access-key/${accountId}`;
      uiLogger.info(
        lib.sandbox.create.developer.failure.scopes.instructions(
          accountConfig.name || accountId,
          url
        )
      );
    } else {
      logError(err);
    }
    throw err;
  }
  try {
    const { name } = await hubspotAccountNamePrompt({
      accountType: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
    });

    trackCommandMetadataUsage(
      'sandbox-create',
      { step: 'project-dev' },
      accountId
    );

    const result = await buildV2Sandbox(
      name,
      accountConfig,
      HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
      false, // syncObjectRecords
      env
    );

    return result.sandbox.sandboxHubId;
  } catch (err) {
    logError(err);
    throw err;
  }
}

// Create a developer test account and return its accountId
export async function createDeveloperTestAccountForLocalDev(
  accountId: number,
  accountConfig: HubSpotConfigAccount,
  env: Environment,
  useV2 = false
): Promise<number> {
  let currentPortalCount = 0;
  let maxTestPortals = 10;
  try {
    const validateResult =
      await validateDevTestAccountUsageLimits(accountConfig);
    if (validateResult) {
      currentPortalCount = validateResult.results
        ? validateResult.results.length
        : 0;
      maxTestPortals = validateResult.maxTestPortals;
    }
  } catch (err) {
    if (isMissingScopeError(err)) {
      uiLogger.error(lib.developerTestAccount.create.failure.scopes.message);
      const websiteOrigin = getHubSpotWebsiteOrigin(env);
      const url = `${websiteOrigin}/personal-access-key/${accountId}`;
      uiLogger.info(
        lib.developerTestAccount.create.failure.scopes.instructions(
          accountConfig.name || accountId,
          url
        )
      );
    } else {
      logError(err);
    }
    throw err;
  }

  try {
    const { name } = await hubspotAccountNamePrompt({
      currentPortalCount,
      accountType: HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST,
    });
    trackCommandMetadataUsage(
      'developer-test-account-create',
      { step: 'project-dev' },
      accountId
    );

    return await buildDeveloperTestAccount(
      name,
      accountConfig,
      env,
      maxTestPortals,
      useV2
    );
  } catch (err) {
    logError(err);
    throw err;
  }
}

// Prompt user to confirm usage of an existing developer test account that is not currently in the config
export async function useExistingDevTestAccount(
  env: Environment,
  account: DeveloperTestAccount
): Promise<boolean> {
  const useExistingDevTestAcct =
    await confirmUseExistingDeveloperTestAccountPrompt(account);
  if (!useExistingDevTestAcct) {
    uiLogger.log('');
    uiLogger.log(lib.localDevHelpers.account.declineDefaultAccountExplanation);
    uiLogger.log('');
    return false;
  }
  const devTestAcctConfigName = await saveAccountToConfig(
    account.id,
    account.accountName,
    env
  );
  uiLogger.success(
    lib.developerTestAccount.create.success.configFileUpdated(
      devTestAcctConfigName,
      PERSONAL_ACCESS_KEY_AUTH_METHOD.name
    )
  );
  return true;
}

export async function hasSandboxes(
  account: HubSpotConfigAccount
): Promise<boolean> {
  const accountId = account.accountId;
  if (!accountId) {
    return false;
  }

  try {
    const {
      data: { usage },
    } = await getSandboxUsageLimits(accountId);

    return usage.STANDARD.limit > 0 || usage.DEVELOPER.limit > 0;
  } catch (e) {
    debugError(e);
    return false;
  }
}

// Top level prompt to choose the type of account to test on
export async function selectAccountTypePrompt(
  accountConfig: HubSpotConfigAccount
): Promise<string | null> {
  const hasAccessToSandboxes = await hasSandboxes(accountConfig);
  const accountId = accountConfig.accountId;

  const result = await listPrompt(
    lib.localDevHelpers.account.selectAccountTypePrompt.message,
    {
      choices: [
        {
          name: lib.localDevHelpers.account.selectAccountTypePrompt
            .developerTestAccountOption,
          value: HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST,
        },
        {
          name: lib.localDevHelpers.account.selectAccountTypePrompt
            .sandboxAccountOption,
          value: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
          disabled: !hasAccessToSandboxes
            ? lib.localDevHelpers.account.selectAccountTypePrompt
                .sandboxAccountOptionDisabled
            : false,
        },
        {
          name: lib.localDevHelpers.account.selectAccountTypePrompt.productionAccountOption(
            accountId
          ),
          value: null,
        },
      ],
    }
  );

  return result;
}

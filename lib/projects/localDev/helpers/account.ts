import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { HUBSPOT_ACCOUNT_TYPE_STRINGS } from '@hubspot/local-dev-lib/constants/config';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { getAccountIdentifier } from '@hubspot/local-dev-lib/config/getAccountIdentifier';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { Environment } from '@hubspot/local-dev-lib/types/Config';
import { isMissingScopeError } from '@hubspot/local-dev-lib/errors/index';
import { DeveloperTestAccount } from '@hubspot/local-dev-lib/types/developerTestAccounts.js';
import { PERSONAL_ACCESS_KEY_AUTH_METHOD } from '@hubspot/local-dev-lib/constants/auth';
import { getSandboxUsageLimits } from '@hubspot/local-dev-lib/api/sandboxHubs';

import { uiLogger } from '../../../ui/logger.js';
import { lib } from '../../../../lang/en.js';
import { EXIT_CODES } from '../../../enums/exitCodes.js';
import { confirmDefaultAccountPrompt } from '../../../prompts/projectDevTargetAccountPrompt.js';
import { isUnifiedAccount } from '../../../accountTypes.js';
import { isAppDeveloperAccount } from '../../../accountTypes.js';
import { isDeveloperTestAccount } from '../../../accountTypes.js';
import { uiAccountDescription } from '../../../ui/index.js';
import { uiLine } from '../../../ui/index.js';
import { selectDeveloperTestTargetAccountPrompt } from '../../../prompts/projectDevTargetAccountPrompt.js';
import { selectSandboxTargetAccountPrompt } from '../../../prompts/projectDevTargetAccountPrompt.js';
import { ProjectDevTargetAccountPromptResponse } from '../../../prompts/projectDevTargetAccountPrompt.js';
import { validateSandboxUsageLimits } from '../../../sandboxes.js';
import { logError } from '../../../errorHandlers/index.js';
import { syncSandbox } from '../../../sandboxSync.js';
import { getAvailableSyncTypes } from '../../../sandboxes.js';
import { hubspotAccountNamePrompt } from '../../../prompts/accountNamePrompt.js';
import { trackCommandMetadataUsage } from '../../../usageTracking.js';
import { validateDevTestAccountUsageLimits } from '../../../developerTestAccounts.js';
import {
  buildSandbox,
  buildDeveloperTestAccount,
  saveAccountToConfig,
} from '../../../buildAccount.js';
import { debugError } from '../../../errorHandlers/index.js';
import { listPrompt } from '../../../prompts/promptUtils.js';
import { confirmUseExistingDeveloperTestAccountPrompt } from '../../../prompts/projectDevTargetAccountPrompt.js';

// If the user passed in the --account flag, confirm they want to use that account as
// their target account, otherwise exit
export async function confirmDefaultAccountIsTarget(
  accountConfig: CLIAccount
): Promise<void> {
  if (!accountConfig.name || !accountConfig.accountType) {
    uiLogger.error(
      lib.localDevHelpers.account.confirmDefaultAccountIsTarget.configError
    );
    process.exit(EXIT_CODES.ERROR);
  }

  uiLogger.log('');
  const useDefaultAccount = await confirmDefaultAccountPrompt(
    accountConfig.name,
    HUBSPOT_ACCOUNT_TYPE_STRINGS[accountConfig.accountType]
  );

  if (!useDefaultAccount) {
    uiLogger.log(
      lib.localDevHelpers.account.confirmDefaultAccountIsTarget
        .declineDefaultAccountExplanation
    );
    process.exit(EXIT_CODES.SUCCESS);
  }
}

// Confirm the default account is supported for the type of apps being developed
export async function checkIfDefaultAccountIsSupported(
  accountConfig: CLIAccount,
  hasPublicApps: boolean
): Promise<void> {
  const defaultAccountIsUnified = await isUnifiedAccount(accountConfig);

  if (
    hasPublicApps &&
    !(
      isAppDeveloperAccount(accountConfig) ||
      isDeveloperTestAccount(accountConfig) ||
      defaultAccountIsUnified
    )
  ) {
    uiLogger.error(
      lib.localDevHelpers.account.checkIfDefaultAccountIsSupported.publicApp
    );
    process.exit(EXIT_CODES.SUCCESS);
  } else if (!hasPublicApps && isAppDeveloperAccount(accountConfig)) {
    uiLogger.error(
      lib.localDevHelpers.account.checkIfDefaultAccountIsSupported.privateApp
    );
    process.exit(EXIT_CODES.SUCCESS);
  }
}

export function checkIfParentAccountIsAuthed(accountConfig: CLIAccount): void {
  if (
    !accountConfig.parentAccountId ||
    !getAccountConfig(accountConfig.parentAccountId)
  ) {
    uiLogger.error(
      lib.localDevHelpers.account.checkIfParentAccountIsAuthed.notAuthedError(
        accountConfig.parentAccountId || '',
        uiAccountDescription(getAccountIdentifier(accountConfig))
      )
    );
    process.exit(EXIT_CODES.SUCCESS);
  }
}

// Confirm the default account is a developer account if developing public apps
export function checkIfAccountFlagIsSupported(
  accountConfig: CLIAccount,
  hasPublicApps: boolean
): void {
  if (hasPublicApps) {
    if (!isDeveloperTestAccount(accountConfig)) {
      uiLogger.error(
        lib.localDevHelpers.account.validateAccountOption
          .invalidPublicAppAccount
      );
      process.exit(EXIT_CODES.SUCCESS);
    }
    checkIfParentAccountIsAuthed(accountConfig);
  } else if (isAppDeveloperAccount(accountConfig)) {
    uiLogger.error(
      lib.localDevHelpers.account.validateAccountOption.invalidPrivateAppAccount
    );
    process.exit(EXIT_CODES.SUCCESS);
  }
}

// If the user isn't using the recommended account type, prompt them to use or create one
export async function suggestRecommendedNestedAccount(
  accounts: CLIAccount[],
  accountConfig: CLIAccount,
  hasPublicApps: boolean
): Promise<ProjectDevTargetAccountPromptResponse> {
  uiLogger.log('');
  uiLine();
  if (hasPublicApps) {
    uiLogger.log(
      lib.localDevHelpers.account.validateAccountOption
        .publicAppNonDeveloperTestAccountWarning
    );
  } else {
    uiLogger.log(
      lib.localDevHelpers.account.validateAccountOption.nonSandboxWarning
    );
  }
  uiLine();
  uiLogger.log('');

  const targetAccountPrompt = hasPublicApps
    ? selectDeveloperTestTargetAccountPrompt
    : selectSandboxTargetAccountPrompt;

  return targetAccountPrompt(accounts, accountConfig);
}

// Create a new sandbox and return its accountId
export async function createSandboxForLocalDev(
  accountId: number,
  accountConfig: CLIAccount,
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
    process.exit(EXIT_CODES.ERROR);
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

    const result = await buildSandbox(
      name,
      accountConfig,
      HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
      env
    );

    const targetAccountId = result.sandbox.sandboxHubId;

    const sandboxAccountConfig = getAccountConfig(result.sandbox.sandboxHubId);

    if (!sandboxAccountConfig) {
      uiLogger.error(lib.sandbox.create.developer.failure.generic);
      process.exit(EXIT_CODES.ERROR);
    }

    const syncTasks = await getAvailableSyncTypes(
      accountConfig,
      sandboxAccountConfig
    );
    // For v1 sandboxes, keep sync here. Once we migrate to v2, this will be handled by BE automatically
    await syncSandbox(
      sandboxAccountConfig,
      accountConfig,
      env,
      syncTasks,
      true
    );
    return targetAccountId;
  } catch (err) {
    logError(err);
    process.exit(EXIT_CODES.ERROR);
  }
}

// Create a developer test account and return its accountId
export async function createDeveloperTestAccountForLocalDev(
  accountId: number,
  accountConfig: CLIAccount,
  env: Environment,
  useV3 = false
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
    process.exit(EXIT_CODES.ERROR);
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

    const result = await buildDeveloperTestAccount(
      name,
      accountConfig,
      env,
      maxTestPortals,
      useV3
    );

    return result;
  } catch (err) {
    logError(err);
    process.exit(EXIT_CODES.ERROR);
  }
}

// Prompt user to confirm usage of an existing developer test account that is not currently in the config
export async function useExistingDevTestAccount(
  env: Environment,
  account: DeveloperTestAccount
): Promise<void> {
  const useExistingDevTestAcct =
    await confirmUseExistingDeveloperTestAccountPrompt(account);
  if (!useExistingDevTestAcct) {
    uiLogger.log('');
    uiLogger.log(
      lib.localDevHelpers.account.confirmDefaultAccountIsTarget
        .declineDefaultAccountExplanation
    );
    uiLogger.log('');
    process.exit(EXIT_CODES.SUCCESS);
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
}

export async function hasSandboxes(account: CLIAccount): Promise<boolean> {
  const accountId = getAccountIdentifier(account);
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
  accountConfig: CLIAccount
): Promise<string | null> {
  const hasAccessToSandboxes = await hasSandboxes(accountConfig);
  const accountId = getAccountIdentifier(accountConfig);

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

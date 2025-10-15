import {
  getAccessToken,
  updateConfigWithAccessToken,
} from '@hubspot/local-dev-lib/personalAccessKey';
import {
  accountNameExistsInConfig,
  updateAccountConfig,
  writeConfig,
  getAccountId,
} from '@hubspot/local-dev-lib/config';
import { getAccountIdentifier } from '@hubspot/local-dev-lib/config/getAccountIdentifier';
import { uiLogger } from './ui/logger.js';
import {
  createDeveloperTestAccount,
  fetchDeveloperTestAccountGateSyncStatus,
  generateDeveloperTestAccountPersonalAccessKey,
} from '@hubspot/local-dev-lib/api/developerTestAccounts';
import { DeveloperTestAccountConfig } from '@hubspot/local-dev-lib/types/developerTestAccounts';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import {
  createSandbox,
  createV2Sandbox,
  getSandboxPersonalAccessKey,
} from '@hubspot/local-dev-lib/api/sandboxHubs';
import { Environment } from '@hubspot/local-dev-lib/types/Config';

import { personalAccessKeyPrompt } from './prompts/personalAccessKeyPrompt.js';
import { createDeveloperTestAccountConfigPrompt } from './prompts/createDeveloperTestAccountConfigPrompt.js';
import { cliAccountNamePrompt } from './prompts/accountNamePrompt.js';
import SpinniesManager from './ui/SpinniesManager.js';
import { debugError, logError } from './errorHandlers/index.js';
import {
  SANDBOX_API_TYPE_MAP,
  SANDBOX_TYPE_MAP_V2,
  handleSandboxCreateError,
} from './sandboxes.js';
import { handleDeveloperTestAccountCreateError } from './developerTestAccounts.js';
import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import {
  SandboxResponse,
  V2Sandbox,
} from '@hubspot/local-dev-lib/types/Sandbox';
import { SandboxAccountType } from '../types/Sandboxes.js';
import { lib } from '../lang/en.js';
import { poll } from './polling.js';

export async function saveAccountToConfig(
  accountId: number | undefined,
  accountName: string,
  env: Environment,
  personalAccessKey?: string,
  force = false
): Promise<string> {
  if (!personalAccessKey) {
    const configData = await personalAccessKeyPrompt({
      env,
      account: accountId,
    });
    personalAccessKey = configData.personalAccessKey;
  }

  const token = await getAccessToken(personalAccessKey, env);
  const updatedConfig = await updateConfigWithAccessToken(
    token,
    personalAccessKey,
    env
  );

  let validName = updatedConfig?.name || '';
  if (!updatedConfig?.name) {
    const nameForConfig = accountName.toLowerCase().split(' ').join('-');
    validName = nameForConfig;
    const invalidAccountName = accountNameExistsInConfig(nameForConfig);
    if (invalidAccountName) {
      if (!force) {
        uiLogger.log('');
        uiLogger.warn(
          lib.prompts.accountNamePrompt.errors.accountNameExists(nameForConfig)
        );
        const { name: promptName } = await cliAccountNamePrompt(
          nameForConfig + `_${accountId}`
        );
        validName = promptName;
      } else {
        // Basic invalid name handling when force flag is passed
        validName = nameForConfig + `_${accountId}`;
      }
    }
  }

  updateAccountConfig({
    ...updatedConfig,
    env: updatedConfig?.env,
    tokenInfo: updatedConfig?.auth?.tokenInfo,
    name: validName,
  });
  writeConfig();

  uiLogger.log('');
  return validName;
}

export async function createDeveloperTestAccountV2(
  parentAccountId: number,
  testAccountConfig: DeveloperTestAccountConfig
): Promise<{
  accountName: string;
  accountId?: number;
  personalAccessKey?: string;
}> {
  const result: {
    accountName: string;
    accountId?: number;
    personalAccessKey?: string;
  } = {
    accountName: testAccountConfig.accountName,
  };

  const { data } = await createDeveloperTestAccount(
    parentAccountId,
    testAccountConfig
  );

  result.accountId = data.id;

  try {
    await poll(
      () =>
        fetchDeveloperTestAccountGateSyncStatus(
          parentAccountId,
          result.accountId!
        ),
      {
        successStates: ['SUCCESS'],
        errorStates: [],
      }
    );
  } catch (err) {
    debugError(err);
    throw new Error(lib.buildAccount.createDeveloperTestAccountV2.syncFailure);
  }

  // HACK: The status endpoint sometimes returns an early success status.
  // Sleep for an extra 5 seconds to make sure the sync is actually complete.
  await new Promise(resolve => setTimeout(resolve, 5000));

  try {
    // Attempt to generate a new personal access key for the test account now that gate sync is complete.
    const { data } = await generateDeveloperTestAccountPersonalAccessKey(
      parentAccountId,
      result.accountId!
    );

    result.personalAccessKey = data.personalAccessKey;
  } catch (err) {
    debugError(err);
    throw new Error(lib.buildAccount.createDeveloperTestAccountV2.pakFailure);
  }

  return result;
}

export async function buildDeveloperTestAccount(
  testAccountName: string,
  parentAccountConfig: CLIAccount,
  env: Environment,
  portalLimit: number,
  useV2 = false
): Promise<number> {
  const id = getAccountIdentifier(parentAccountConfig);
  const parentAccountId = getAccountId(id);
  let testAccountConfig: DeveloperTestAccountConfig = {
    accountName: testAccountName,
  };

  if (!parentAccountId) {
    throw new Error(lib.developerTestAccount.create.loading.fail(''));
  }

  if (useV2) {
    testAccountConfig = await createDeveloperTestAccountConfigPrompt(
      {
        name: testAccountConfig.accountName,
        description: 'Test Account created by the HubSpot CLI',
      },
      false
    );
  }

  SpinniesManager.init({
    succeedColor: 'white',
  });

  uiLogger.log('');
  SpinniesManager.add('buildDeveloperTestAccount', {
    text: lib.developerTestAccount.create.loading.add(testAccountName),
  });

  let developerTestAccountId: number;
  let developerTestAccountPersonalAccessKey: string;

  try {
    if (useV2) {
      const result = await createDeveloperTestAccountV2(
        parentAccountId,
        testAccountConfig
      );

      developerTestAccountId = result.accountId!;
      developerTestAccountPersonalAccessKey = result.personalAccessKey!;
    } else {
      const { data } = await createDeveloperTestAccount(
        parentAccountId,
        testAccountName
      );

      developerTestAccountId = data.id;
      developerTestAccountPersonalAccessKey = data.personalAccessKey;
    }

    SpinniesManager.succeed('buildDeveloperTestAccount', {
      text: lib.developerTestAccount.create.loading.succeed(
        testAccountName,
        developerTestAccountId.toString()
      ),
    });
  } catch (e) {
    debugError(e);

    SpinniesManager.fail('buildDeveloperTestAccount', {
      text: lib.developerTestAccount.create.loading.fail(testAccountName),
    });

    handleDeveloperTestAccountCreateError(e, parentAccountId, env, portalLimit);
  }

  try {
    await saveAccountToConfig(
      developerTestAccountId,
      testAccountName,
      env,
      developerTestAccountPersonalAccessKey
    );
  } catch (err) {
    logError(err);
    throw err;
  }

  return developerTestAccountId;
}

type SandboxAccount = SandboxResponse & {
  name: string;
};

export async function buildSandbox(
  sandboxName: string,
  parentAccountConfig: CLIAccount,
  sandboxType: SandboxAccountType,
  env: Environment,
  force = false
): Promise<SandboxAccount> {
  const sandboxTypeKey =
    sandboxType === HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX
      ? 'standard'
      : 'developer';

  const id = getAccountIdentifier(parentAccountConfig);
  const parentAccountId = getAccountId(id);

  if (!parentAccountId) {
    throw new Error(lib.sandbox.create[sandboxTypeKey].loading.fail(''));
  }

  SpinniesManager.init({
    succeedColor: 'white',
  });

  uiLogger.log('');
  SpinniesManager.add('buildSandbox', {
    text: lib.sandbox.create[sandboxTypeKey].loading.add(sandboxName),
  });

  let sandbox: SandboxAccount;

  try {
    const sandboxApiType = SANDBOX_API_TYPE_MAP[sandboxType];

    const { data } = await createSandbox(
      parentAccountId,
      sandboxName,
      sandboxApiType
    );
    sandbox = { name: sandboxName, ...data };

    SpinniesManager.succeed('buildSandbox', {
      text: lib.sandbox.create[sandboxTypeKey].loading.succeed(
        sandboxName,
        sandbox.sandbox.sandboxHubId.toString()
      ),
    });
  } catch (e) {
    debugError(e);

    SpinniesManager.fail('buildSandbox', {
      text: lib.sandbox.create[sandboxTypeKey].loading.fail(sandboxName),
    });

    handleSandboxCreateError(e, env, sandboxName, parentAccountId);
  }

  try {
    await saveAccountToConfig(
      sandbox.sandbox.sandboxHubId,
      sandboxName,
      env,
      sandbox.personalAccessKey,
      force
    );
  } catch (err) {
    logError(err);
    throw err;
  }

  return sandbox;
}

export async function buildV2Sandbox(
  sandboxName: string,
  parentAccountConfig: CLIAccount,
  sandboxType: SandboxAccountType,
  syncObjectRecords: boolean,
  env: Environment,
  force = false
) {
  const sandboxTypeKey =
    sandboxType === HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX
      ? 'standard'
      : 'developer';
  const id = getAccountIdentifier(parentAccountConfig);
  const parentAccountId = getAccountId(id);

  if (!parentAccountId) {
    throw new Error(lib.sandbox.create[sandboxTypeKey].loading.fail(''));
  }

  SpinniesManager.init({
    succeedColor: 'white',
  });

  uiLogger.log('');
  SpinniesManager.add('buildV2Sandbox', {
    text: lib.sandbox.create[sandboxTypeKey].loading.add(sandboxName),
  });

  let sandbox: V2Sandbox;
  let pak: string;

  try {
    const sandboxTypeV2 = SANDBOX_TYPE_MAP_V2[sandboxType];
    const { data } = await createV2Sandbox(
      parentAccountId,
      sandboxName,
      sandboxTypeV2,
      syncObjectRecords
    );
    sandbox = { ...data };

    const {
      data: { personalAccessKey },
    } = await getSandboxPersonalAccessKey(
      parentAccountId,
      sandbox.sandboxHubId
    );
    pak = personalAccessKey.encodedOAuthRefreshToken;

    SpinniesManager.succeed('buildV2Sandbox', {
      text: lib.sandbox.create[sandboxTypeKey].loading.succeed(
        sandboxName,
        sandbox.sandboxHubId.toString()
      ),
    });
  } catch (e) {
    debugError(e);
    SpinniesManager.fail('buildV2Sandbox', {
      text: lib.sandbox.create[sandboxTypeKey].loading.fail(sandboxName),
    });

    handleSandboxCreateError(e, env, sandboxName, parentAccountId);
  }

  try {
    await saveAccountToConfig(
      sandbox.sandboxHubId,
      sandboxName,
      env,
      pak,
      force
    );
  } catch (err) {
    logError(err);
    throw err;
  }

  return { sandbox };
}

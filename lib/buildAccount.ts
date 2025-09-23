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
import { logger } from '@hubspot/local-dev-lib/logger';
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
import { i18n } from './lang.js';
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
        logger.log('');
        logger.warn(
          i18n(`lib.prompts.accountNamePrompt.errors.accountNameExists`, {
            name: nameForConfig,
          })
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

  logger.log('');
  return validName;
}

export async function createDeveloperTestAccountV3(
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
    throw new Error(lib.buildAccount.createDeveloperTestAccountV3.syncFailure);
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
    throw new Error(lib.buildAccount.createDeveloperTestAccountV3.pakFailure);
  }

  return result;
}

export async function buildDeveloperTestAccount(
  testAccountName: string,
  parentAccountConfig: CLIAccount,
  env: Environment,
  portalLimit: number,
  useV3 = false
): Promise<number> {
  const id = getAccountIdentifier(parentAccountConfig);
  const parentAccountId = getAccountId(id);
  let testAccountConfig: DeveloperTestAccountConfig = {
    accountName: testAccountName,
  };

  if (!parentAccountId) {
    throw new Error(i18n(`lib.developerTestAccount.create.loading.fail`));
  }

  if (useV3) {
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

  logger.log('');
  SpinniesManager.add('buildDeveloperTestAccount', {
    text: i18n(`lib.developerTestAccount.create.loading.add`, {
      accountName: testAccountName,
    }),
  });

  let developerTestAccountId: number;
  let developerTestAccountPersonalAccessKey: string;

  try {
    if (useV3) {
      const result = await createDeveloperTestAccountV3(
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
      text: i18n(`lib.developerTestAccount.create.loading.succeed`, {
        accountName: testAccountName,
        accountId: developerTestAccountId,
      }),
    });
  } catch (e) {
    debugError(e);

    SpinniesManager.fail('buildDeveloperTestAccount', {
      text: i18n(`lib.developerTestAccount.create.loading.fail`, {
        accountName: testAccountName,
      }),
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
  let i18nKey: string;
  if (sandboxType === HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX) {
    i18nKey = 'lib.sandbox.create.loading.standard';
  } else {
    i18nKey = 'lib.sandbox.create.loading.developer';
  }

  const id = getAccountIdentifier(parentAccountConfig);
  const parentAccountId = getAccountId(id);

  if (!parentAccountId) {
    throw new Error(i18n(`${i18nKey}.fail`));
  }

  SpinniesManager.init({
    succeedColor: 'white',
  });

  logger.log('');
  SpinniesManager.add('buildSandbox', {
    text: i18n(`${i18nKey}.add`, {
      accountName: sandboxName,
    }),
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
      text: i18n(`${i18nKey}.succeed`, {
        accountName: sandboxName,
        accountId: sandbox.sandbox.sandboxHubId,
      }),
    });
  } catch (e) {
    debugError(e);

    SpinniesManager.fail('buildSandbox', {
      text: i18n(`${i18nKey}.fail`, {
        accountName: sandboxName,
      }),
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
  let i18nKey: string;
  if (sandboxType === HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX) {
    i18nKey = 'lib.sandbox.create.loading.standard';
  } else {
    i18nKey = 'lib.sandbox.create.loading.developer';
  }
  const id = getAccountIdentifier(parentAccountConfig);
  const parentAccountId = getAccountId(id);

  if (!parentAccountId) {
    throw new Error(i18n(`${i18nKey}.fail`));
  }

  SpinniesManager.init({
    succeedColor: 'white',
  });

  logger.log('');
  SpinniesManager.add('buildV2Sandbox', {
    text: i18n(`${i18nKey}.add`, {
      accountName: sandboxName,
    }),
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
      text: i18n(`${i18nKey}.succeed`, {
        accountName: sandboxName,
        accountId: sandbox.sandboxHubId,
      }),
    });
  } catch (e) {
    debugError(e);
    SpinniesManager.fail('buildV2Sandbox', {
      text: i18n(`${i18nKey}.fail`, {
        accountName: sandboxName,
      }),
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

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
import { createDeveloperTestAccount } from '@hubspot/local-dev-lib/api/developerTestAccounts';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import {
  createSandbox,
  createV2Sandbox,
  getPersonalAccessKey,
} from '@hubspot/local-dev-lib/api/sandboxHubs';
import { Environment } from '@hubspot/local-dev-lib/types/Config';

import { personalAccessKeyPrompt } from './prompts/personalAccessKeyPrompt';
import { i18n } from './lang';
import { cliAccountNamePrompt } from './prompts/accountNamePrompt';
import SpinniesManager from './ui/SpinniesManager';
import { debugError, logError } from './errorHandlers/index';

import {
  SANDBOX_API_TYPE_MAP,
  SANDBOX_TYPE_MAP_V2,
  handleSandboxCreateError,
} from './sandboxes';
import { handleDeveloperTestAccountCreateError } from './developerTestAccounts';
import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { DeveloperTestAccount } from '@hubspot/local-dev-lib/types/developerTestAccounts';
import {
  SandboxResponse,
  V2Sandbox,
} from '@hubspot/local-dev-lib/types/Sandbox';
import { SandboxAccountType } from '../types/Sandboxes';

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

export async function buildDeveloperTestAccount(
  testAccountName: string,
  parentAccountConfig: CLIAccount,
  env: Environment,
  portalLimit: number
): Promise<DeveloperTestAccount> {
  const i18nKey = 'lib.developerTestAccount.create.loading';

  const id = getAccountIdentifier(parentAccountConfig);
  const parentAccountId = getAccountId(id);

  if (!parentAccountId) {
    throw new Error(i18n(`${i18nKey}.fail`));
  }

  SpinniesManager.init({
    succeedColor: 'white',
  });

  logger.log('');
  SpinniesManager.add('buildDeveloperTestAccount', {
    text: i18n(`${i18nKey}.add`, {
      accountName: testAccountName,
    }),
  });

  let developerTestAccount: DeveloperTestAccount;

  try {
    const { data } = await createDeveloperTestAccount(
      parentAccountId,
      testAccountName
    );

    developerTestAccount = data;

    SpinniesManager.succeed('buildDeveloperTestAccount', {
      text: i18n(`${i18nKey}.succeed`, {
        accountName: testAccountName,
        accountId: developerTestAccount.id,
      }),
    });
  } catch (e) {
    debugError(e);

    SpinniesManager.fail('buildDeveloperTestAccount', {
      text: i18n(`${i18nKey}.fail`, {
        accountName: testAccountName,
      }),
    });

    handleDeveloperTestAccountCreateError(e, parentAccountId, env, portalLimit);
  }

  try {
    await saveAccountToConfig(developerTestAccount.id, testAccountName, env);
  } catch (err) {
    logError(err);
    throw err;
  }

  return developerTestAccount;
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
  let pak: string | undefined;

  try {
    const sandboxTypeV2 = SANDBOX_TYPE_MAP_V2[sandboxType];
    const { data } = await createV2Sandbox(
      parentAccountId,
      sandboxName,
      sandboxTypeV2,
      syncObjectRecords
    );
    sandbox = { ...data };

    // TODO: Either set up temporary poll, or wait for BE to remove sandbox readiness check when fetching PAK
    const {
      data: { personalAccessKey },
    } = await getPersonalAccessKey(parentAccountId, sandbox.sandboxHubId);
    pak = personalAccessKey?.oauthAccessToken;

    SpinniesManager.succeed('buildSandbox', {
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

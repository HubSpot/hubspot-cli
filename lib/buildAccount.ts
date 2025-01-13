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
import { createSandbox } from '@hubspot/local-dev-lib/api/sandboxHubs';
import { Environment } from '@hubspot/local-dev-lib/types/Config';

import { personalAccessKeyPrompt } from './prompts/personalAccessKeyPrompt';
import { i18n } from './lang';
import { cliAccountNamePrompt } from './prompts/accountNamePrompt';
import SpinniesManager from './ui/SpinniesManager';
import { debugError, logError } from './errorHandlers/index';

import { SANDBOX_API_TYPE_MAP, handleSandboxCreateError } from './sandboxes';
import { handleDeveloperTestAccountCreateError } from './developerTestAccounts';
import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';

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

type ValidBuildAccountType =
  | typeof HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX
  | typeof HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX
  | typeof HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST;

type BuildNewAccountOptions = {
  name: string;
  accountType: ValidBuildAccountType;
  accountConfig: CLIAccount;
  env: Environment;
  portalLimit?: number;
  force?: boolean;
};

export async function buildNewAccount({
  name,
  accountType,
  accountConfig,
  env,
  portalLimit, // Used only for developer test accounts
  force = false,
}: BuildNewAccountOptions) {
  SpinniesManager.init({
    succeedColor: 'white',
  });
  const id = getAccountIdentifier(accountConfig);
  const accountId = getAccountId(id);
  const isSandbox =
    accountType === HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX ||
    accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX;
  const isDeveloperTestAccount =
    accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST;

  if ((!isSandbox && !isDeveloperTestAccount) || !accountId) {
    return;
  }

  let result;
  let spinniesI18nKey: string;
  if (isSandbox) {
    if (accountType === HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX) {
      spinniesI18nKey = 'lib.sandbox.create.loading.standard';
    }
    if (accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX) {
      spinniesI18nKey = 'lib.sandbox.create.loading.developer';
    }
  } else {
    spinniesI18nKey = 'lib.developerTestAccount.create.loading';
  }

  logger.log('');
  SpinniesManager.add('buildNewAccount', {
    text: i18n(`${spinniesI18nKey}.add`, {
      accountName: name,
    }),
  });

  let resultAccountId;
  let resultPersonalAccessKey;
  try {
    if (isSandbox) {
      const sandboxApiType = SANDBOX_API_TYPE_MAP[accountType]; // API expects sandbox type as 1 or 2.

      const { data } = await createSandbox(accountId, name, sandboxApiType);
      result = { name, ...data };
      resultAccountId = result.sandbox.sandboxHubId;
      resultPersonalAccessKey = result.personalAccessKey;
    } else if (isDeveloperTestAccount) {
      const { data } = await createDeveloperTestAccount(accountId, name);
      result = data;
      resultAccountId = result.id;
    }

    SpinniesManager.succeed('buildNewAccount', {
      text: i18n(`${spinniesI18nKey}.succeed`, {
        accountName: name,
        accountId: resultAccountId,
      }),
    });
  } catch (err) {
    debugError(err);

    SpinniesManager.fail('buildNewAccount', {
      text: i18n(`${spinniesI18nKey}.fail`, {
        accountName: name,
      }),
    });

    if (isSandbox) {
      handleSandboxCreateError(err, env, name, accountId);
    }
    if (isDeveloperTestAccount) {
      handleDeveloperTestAccountCreateError(err, env, accountId, portalLimit);
    }
  }

  let configAccountName: string;

  try {
    // Response contains PAK, save to config here
    configAccountName = await saveAccountToConfig(
      resultAccountId,
      name,
      env,
      resultPersonalAccessKey,
      force
    );
  } catch (err) {
    logError(err);
    throw err;
  }

  return {
    configAccountName,
    result,
  };
}

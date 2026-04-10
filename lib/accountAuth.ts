import {
  updateConfigAccount,
  createEmptyConfigFile,
  getConfigFilePath,
  localConfigFileExists,
  globalConfigFileExists,
  setConfigAccountAsDefault,
} from '@hubspot/local-dev-lib/config';
import {
  getAccessToken,
  updateConfigWithAccessToken,
} from '@hubspot/local-dev-lib/personalAccessKey';
import { toKebabCase } from '@hubspot/local-dev-lib/text';
import { Environment } from '@hubspot/local-dev-lib/types/Accounts';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { handleMerge, handleMigration } from './configMigrate.js';
import { debugError, logError } from './errorHandlers/index.js';
import { isPromptExitError } from './errors/PromptExitError.js';
import { personalAccessKeyPrompt } from './prompts/personalAccessKeyPrompt.js';
import { cliAccountNamePrompt } from './prompts/accountNamePrompt.js';
import { setAsDefaultAccountPrompt } from './prompts/setAsDefaultAccountPrompt.js';
import { commands } from '../lang/en.js';
import { uiLogger } from './ui/logger.js';

async function updateConfigWithNewAccount(
  env: Environment,
  configAlreadyExists: boolean,
  providedPersonalAccessKey?: string,
  accountId?: number
): Promise<HubSpotConfigAccount | null> {
  try {
    const { personalAccessKey } = providedPersonalAccessKey
      ? { personalAccessKey: providedPersonalAccessKey }
      : await personalAccessKeyPrompt({
          env,
          account: accountId,
        });
    const token = await getAccessToken(personalAccessKey, env);
    const defaultAccountName = token.hubName
      ? toKebabCase(token.hubName)
      : undefined;

    const accountName = configAlreadyExists
      ? undefined
      : (await cliAccountNamePrompt(defaultAccountName)).name;

    const updatedConfig = await updateConfigWithAccessToken(
      token,
      personalAccessKey,
      env,
      accountName,
      !configAlreadyExists
    );

    if (!updatedConfig) return null;

    // Can happen if the user is re-authenticating an account with no name
    if (configAlreadyExists && !updatedConfig.name) {
      updatedConfig.name = (
        await cliAccountNamePrompt(defaultAccountName)
      ).name;
      updateConfigAccount({
        ...updatedConfig,
      });
    }

    return updatedConfig;
  } catch (e) {
    if (isPromptExitError(e)) {
      throw e;
    }
    debugError(e);
    return null;
  }
}

async function handleConfigMigration(): Promise<boolean> {
  const deprecatedConfigExists = localConfigFileExists();
  const globalConfigExists = globalConfigFileExists();

  if (!deprecatedConfigExists) {
    return true;
  }

  if (globalConfigExists) {
    try {
      const mergeConfirmed = await handleMerge();
      if (!mergeConfirmed) {
        uiLogger.log('');
        uiLogger.log(
          commands.account.subcommands.auth.errors.mergeNotConfirmed
        );
      }
      return mergeConfirmed;
    } catch (error) {
      logError(error);
      return false;
    }
  }

  try {
    const migrationConfirmed = await handleMigration();
    if (!migrationConfirmed) {
      uiLogger.log('');
      uiLogger.log(
        commands.account.subcommands.auth.errors.migrationNotConfirmed
      );
    }
    return migrationConfirmed;
  } catch (error) {
    logError(error);
    return false;
  }
}

type AuthenticateNewAccountOptions = {
  env: Environment;
  providedPersonalAccessKey?: string;
  accountId?: number;
  setAsDefaultAccount?: boolean;
};

export async function authenticateNewAccount({
  env,
  providedPersonalAccessKey,
  accountId,
  setAsDefaultAccount,
}: AuthenticateNewAccountOptions): Promise<HubSpotConfigAccount | null> {
  const configMigrationSuccess = await handleConfigMigration();

  if (!configMigrationSuccess) {
    return null;
  }

  const configAlreadyExists = globalConfigFileExists();

  if (!configAlreadyExists) {
    createEmptyConfigFile(true);
  }

  const updatedConfig = await updateConfigWithNewAccount(
    env,
    configAlreadyExists,
    providedPersonalAccessKey,
    accountId
  );

  if (!updatedConfig) {
    uiLogger.error(
      commands.account.subcommands.auth.errors.failedToUpdateConfig
    );
    return null;
  }

  const { accountId: newAccountId, name } = updatedConfig;

  if (!configAlreadyExists) {
    uiLogger.log('');
    uiLogger.success(
      commands.account.subcommands.auth.success.configFileCreated(
        getConfigFilePath()
      )
    );
    uiLogger.success(
      commands.account.subcommands.auth.success.configFileUpdated(newAccountId)
    );
  } else if (setAsDefaultAccount) {
    setConfigAccountAsDefault(name);

    uiLogger.log('');
    uiLogger.success(
      commands.account.subcommands.auth.success.configFileUpdated(newAccountId)
    );
  } else {
    await setAsDefaultAccountPrompt(name);
  }

  return updatedConfig;
}

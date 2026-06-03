import {
  updateConfigAccount,
  createEmptyConfigFile,
  getConfigFilePath,
  localConfigFileExists,
  globalConfigFileExists,
  setConfigAccountAsDefault,
  getConfigDefaultAccountIfExists,
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
import { legacyPersonalAccessKeyPrompt } from './prompts/personalAccessKeyPrompt.js';
import { cliAccountNamePrompt } from './prompts/accountNamePrompt.js';
import { setAsDefaultAccountPrompt } from './prompts/setAsDefaultAccountPrompt.js';
import { awaitPersonalAccessKeyOverWebsocket } from './auth/awaitPersonalAccessKeyOverWebsocket.js';
import { commands } from '../lang/en.js';
import { uiLogger } from './ui/logger.js';

async function getPersonalAccessKey(
  env: Environment,
  accountId?: number
): Promise<string> {
  if (process.env.BROWSER !== 'none') {
    try {
      return await awaitPersonalAccessKeyOverWebsocket({
        env,
        account: accountId,
      });
    } catch (e) {
      if (isPromptExitError(e)) throw e;
      debugError(e);
    }
  }
  const { personalAccessKey } = await legacyPersonalAccessKeyPrompt({
    env,
    account: accountId,
  });
  return personalAccessKey;
}

async function updateConfigWithNewAccount(
  env: Environment,
  configAlreadyExists: boolean,
  providedPersonalAccessKey?: string,
  accountId?: number,
  providedAccountName?: string,
  useDefaultAccountName?: boolean
): Promise<HubSpotConfigAccount | null> {
  try {
    const personalAccessKey =
      providedPersonalAccessKey ?? (await getPersonalAccessKey(env, accountId));
    const token = await getAccessToken(personalAccessKey, env);
    const defaultAccountName = token.hubName
      ? toKebabCase(token.hubName)
      : undefined;

    let accountName: string | undefined;
    if (providedAccountName) {
      accountName = providedAccountName;
    } else if (useDefaultAccountName && defaultAccountName) {
      accountName = defaultAccountName;
    } else if (!configAlreadyExists) {
      accountName = (await cliAccountNamePrompt(defaultAccountName)).name;
    }

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
  accountName?: string;
  useDefaultAccountName?: boolean;
};

export async function authenticateNewAccount({
  env,
  providedPersonalAccessKey,
  accountId,
  setAsDefaultAccount,
  accountName: providedAccountName,
  useDefaultAccountName,
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
    accountId,
    providedAccountName,
    useDefaultAccountName
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
  } else if (setAsDefaultAccount === true) {
    const currentDefault = getConfigDefaultAccountIfExists();
    if (currentDefault?.name !== name) {
      setConfigAccountAsDefault(name);

      uiLogger.log('');
      uiLogger.success(
        commands.account.subcommands.auth.success.configFileUpdated(
          newAccountId
        )
      );
    }
  } else if (setAsDefaultAccount !== false) {
    await setAsDefaultAccountPrompt(name);
  }

  return updatedConfig;
}

import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  loadConfig,
  getConfigPath,
  updateAccountConfig,
  writeConfig,
  createEmptyConfigFile,
  deleteEmptyConfigFile,
  getConfigDefaultAccount,
} from '@hubspot/local-dev-lib/config';
import { configFileExists } from '@hubspot/local-dev-lib/config/migrate';
import { getAccountIdentifier } from '@hubspot/local-dev-lib/config/getAccountIdentifier';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  getAccessToken,
  updateConfigWithAccessToken,
} from '@hubspot/local-dev-lib/personalAccessKey';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { toKebabCase } from '@hubspot/local-dev-lib/text';
import { Environment } from '@hubspot/local-dev-lib/types/Config';
import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { PERSONAL_ACCESS_KEY_AUTH_METHOD } from '@hubspot/local-dev-lib/constants/auth';

import { addGlobalOptions, addTestingOptions } from '../../lib/commonOpts';
import { handleMerge, handleMigration } from '../../lib/configMigrate';
import { handleExit } from '../../lib/process';
import { debugError } from '../../lib/errorHandlers/index';
import { i18n } from '../../lib/lang';
import { trackCommandUsage, trackAuthAction } from '../../lib/usageTracking';
import { personalAccessKeyPrompt } from '../../lib/prompts/personalAccessKeyPrompt';
import { cliAccountNamePrompt } from '../../lib/prompts/accountNamePrompt';
import { setAsDefaultAccountPrompt } from '../../lib/prompts/setAsDefaultAccountPrompt';
import { logError } from '../../lib/errorHandlers/index';
import { trackCommandMetadataUsage } from '../../lib/usageTracking';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { uiFeatureHighlight } from '../../lib/ui';
import { CommonArgs, ConfigArgs } from '../../types/Yargs';

const i18nKey = 'commands.account.subcommands.auth';

const TRACKING_STATUS = {
  STARTED: 'started',
  ERROR: 'error',
  COMPLETE: 'complete',
};

async function updateConfig(
  env: Environment,
  doesConfigExist: boolean,
  disableTracking: boolean | undefined,
  authType: string,
  account?: number
): Promise<CLIAccount | null> {
  try {
    const { personalAccessKey } = await personalAccessKeyPrompt({
      env,
      account,
    });
    const token = await getAccessToken(personalAccessKey, env);
    const defaultName = token.hubName ? toKebabCase(token.hubName) : undefined;

    const name = doesConfigExist
      ? undefined
      : (await cliAccountNamePrompt(defaultName)).name;

    const updatedConfig = await updateConfigWithAccessToken(
      token,
      personalAccessKey,
      env,
      name,
      !doesConfigExist
    );

    if (!updatedConfig) return null;

    if (doesConfigExist && !updatedConfig.name) {
      updatedConfig.name = (await cliAccountNamePrompt(defaultName)).name;
      updateAccountConfig({
        ...updatedConfig,
      });
      writeConfig();
    }

    return updatedConfig;
  } catch (e) {
    if (!disableTracking) {
      await trackAuthAction('account-auth', authType, TRACKING_STATUS.ERROR);
    }
    debugError(e);
    return null;
  }
}

export const describe = i18n(`${i18nKey}.describe`);
export const command = 'auth';

type AccountAuthArgs = CommonArgs &
  ConfigArgs & {
    disableTracking?: boolean;
  };

export async function handler(
  args: ArgumentsCamelCase<AccountAuthArgs>
): Promise<void> {
  const { providedAccountId, disableTracking } = args;
  const authType = PERSONAL_ACCESS_KEY_AUTH_METHOD.value;

  const deprecatedConfigExists = configFileExists(false);
  const globalConfigExists = configFileExists(true);
  if (deprecatedConfigExists) {
    if (globalConfigExists) {
      try {
        await handleMerge(providedAccountId);
      } catch (error) {
        logError(error);
        trackCommandMetadataUsage(
          'account-auth',
          {
            command: 'hs account auth',
            type: 'Merge configs',
            successful: false,
          },
          providedAccountId
        );
        process.exit(EXIT_CODES.ERROR);
      }
    } else {
      try {
        await handleMigration(providedAccountId);
      } catch (error) {
        logError(error);
        trackCommandMetadataUsage(
          'account-auth',
          {
            command: 'hs account auth',
            type: 'Migrate a single config',
            successful: false,
          },
          providedAccountId
        );
        process.exit(EXIT_CODES.ERROR);
      }
    }
  }

  if (!disableTracking) {
    trackCommandUsage('account-auth', {}, providedAccountId);
    await trackAuthAction('account-auth', authType, TRACKING_STATUS.STARTED);
  }

  const env = args.qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD;
  const configAlreadyExists = configFileExists(true);

  if (!configAlreadyExists) {
    createEmptyConfigFile({}, true);
  }
  loadConfig('');

  handleExit(deleteEmptyConfigFile);

  const updatedConfig = await updateConfig(
    env,
    configAlreadyExists,
    disableTracking,
    authType,
    providedAccountId
  );

  if (!updatedConfig) {
    logger.error(i18n(`${i18nKey}.errors.failedToUpdateConfig`));
    process.exit(EXIT_CODES.ERROR);
  }

  const { name } = updatedConfig;
  const accountId = getAccountIdentifier(updatedConfig);

  // If the config file was just created, we don't need to prompt the user to set as default
  if (!configAlreadyExists) {
    logger.log('');
    logger.success(
      i18n(`${i18nKey}.success.configFileCreated`, {
        configPath: getConfigPath('', true)!,
      })
    );
    logger.success(
      i18n(`${i18nKey}.success.configFileUpdated`, {
        account: name || accountId || '',
      })
    );
  } else {
    const setAsDefault = await setAsDefaultAccountPrompt(name!);

    logger.log('');
    if (setAsDefault) {
      logger.success(
        i18n(`lib.prompts.setAsDefaultAccountPrompt.setAsDefaultAccount`, {
          accountName: name!,
        })
      );
    } else {
      logger.info(
        i18n(`lib.prompts.setAsDefaultAccountPrompt.keepingCurrentDefault`, {
          accountName: getConfigDefaultAccount()!,
        })
      );
    }
  }
  uiFeatureHighlight([
    'helpCommand',
    'accountAuthCommand',
    'accountsListCommand',
  ]);

  if (!disableTracking) {
    await trackAuthAction(
      'account-auth',
      authType,
      TRACKING_STATUS.COMPLETE,
      accountId
    );
  }
  process.exit(EXIT_CODES.SUCCESS);
}

export function builder(yargs: Argv): Argv<AccountAuthArgs> {
  yargs.options({
    account: {
      describe: i18n(`${i18nKey}.options.account.describe`),
      type: 'string',
      alias: 'a',
    },
    'disable-tracking': {
      type: 'boolean',
      hidden: true,
      default: false,
    },
  });

  addTestingOptions(yargs);
  addGlobalOptions(yargs);

  return yargs as Argv<AccountAuthArgs>;
}

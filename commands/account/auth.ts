import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  loadConfig,
  updateAccountConfig,
  writeConfig,
  createEmptyConfigFile,
  deleteEmptyConfigFile,
  getConfigDefaultAccount,
} from '@hubspot/local-dev-lib/config';
import {
  configFileExists,
  getConfigPath,
} from '@hubspot/local-dev-lib/config/migrate';
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
import { GLOBAL_CONFIG_PATH } from '@hubspot/local-dev-lib/constants/config';

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
import { uiCommandReference, uiFeatureHighlight } from '../../lib/ui';
import { CommonArgs, ConfigArgs, YargsCommandModule } from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';

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

async function handleConfigMigration(
  providedAccountId: number | undefined
): Promise<boolean> {
  const deprecatedConfigExists = configFileExists(false);
  const globalConfigExists = configFileExists(true);

  if (!deprecatedConfigExists) {
    return true;
  }

  if (globalConfigExists) {
    try {
      const mergeConfirmed = await handleMerge(providedAccountId);
      if (!mergeConfirmed) {
        logger.log(
          i18n('commands.account.subcommands.auth.errors.mergeNotConfirmed', {
            authCommand: uiCommandReference('hs account auth'),
            migrateCommand: uiCommandReference('hs config migrate'),
          })
        );
        process.exit(EXIT_CODES.SUCCESS);
      }
      return mergeConfirmed;
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
  }

  try {
    const migrationConfirmed = await handleMigration(providedAccountId);
    if (!migrationConfirmed) {
      logger.log(
        i18n('commands.account.subcommands.auth.errors.migrationNotConfirmed', {
          authCommand: uiCommandReference('hs auth'),
          deprecatedConfigPath: getConfigPath('', false)!,
        })
      );
      process.exit(EXIT_CODES.SUCCESS);
    }
    return migrationConfirmed;
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

async function handleConfigUpdate(
  env: Environment,
  configAlreadyExists: boolean,
  disableTracking: boolean | undefined,
  authType: string,
  providedAccountId: number | undefined
): Promise<void> {
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
    logger.error(
      i18n('commands.account.subcommands.auth.errors.failedToUpdateConfig')
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const { name } = updatedConfig;
  const accountId = getAccountIdentifier(updatedConfig);

  if (!configAlreadyExists) {
    logger.log('');
    logger.success(
      i18n('commands.account.subcommands.auth.success.configFileCreated', {
        configPath: getConfigPath('', true)!,
      })
    );
    logger.success(
      i18n('commands.account.subcommands.auth.success.configFileUpdated', {
        account: name || accountId?.toString() || '',
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

const describe = i18n('commands.account.subcommands.auth.describe');
const command = 'auth';

type AccountAuthArgs = CommonArgs &
  ConfigArgs & {
    disableTracking?: boolean;
  };

async function handler(
  args: ArgumentsCamelCase<AccountAuthArgs>
): Promise<void> {
  const { providedAccountId, disableTracking } = args;
  const authType = PERSONAL_ACCESS_KEY_AUTH_METHOD.value;

  await handleConfigMigration(providedAccountId);

  if (!disableTracking) {
    trackCommandUsage('account-auth', {}, providedAccountId);
    await trackAuthAction('account-auth', authType, TRACKING_STATUS.STARTED);
  }

  const env = args.qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD;
  const configAlreadyExists = configFileExists(true);

  await handleConfigUpdate(
    env,
    configAlreadyExists,
    disableTracking,
    authType,
    providedAccountId
  );
}

function accountAuthBuilder(yargs: Argv): Argv<AccountAuthArgs> {
  yargs.options({
    account: {
      describe: i18n(
        'commands.account.subcommands.auth.options.account.describe'
      ),
      type: 'string',
      alias: 'a',
    },
    'disable-tracking': {
      type: 'boolean',
      hidden: true,
      default: false,
    },
  });

  return yargs as Argv<AccountAuthArgs>;
}

const builder = makeYargsBuilder<AccountAuthArgs>(
  accountAuthBuilder,
  command,
  i18n('commands.account.subcommands.auth.verboseDescribe', {
    authMethod: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
    globalConfigPath: GLOBAL_CONFIG_PATH,
  }),
  {
    useGlobalOptions: true,
    useTestingOptions: true,
  }
);

const accountAuthCommand: YargsCommandModule<unknown, AccountAuthArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default accountAuthCommand;

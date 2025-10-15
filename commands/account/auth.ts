import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  loadConfig,
  updateAccountConfig,
  writeConfig,
  createEmptyConfigFile,
  deleteEmptyConfigFile,
} from '@hubspot/local-dev-lib/config';
import {
  configFileExists,
  getConfigPath,
} from '@hubspot/local-dev-lib/config/migrate';
import { getAccountIdentifier } from '@hubspot/local-dev-lib/config/getAccountIdentifier';
import {
  getAccessToken,
  updateConfigWithAccessToken,
} from '@hubspot/local-dev-lib/personalAccessKey';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { toKebabCase } from '@hubspot/local-dev-lib/text';
import { Environment } from '@hubspot/local-dev-lib/types/Config';
import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { PERSONAL_ACCESS_KEY_AUTH_METHOD } from '@hubspot/local-dev-lib/constants/auth';
import { handleMerge, handleMigration } from '../../lib/configMigrate.js';
import { handleExit } from '../../lib/process.js';
import { debugError } from '../../lib/errorHandlers/index.js';
import { trackCommandUsage, trackAuthAction } from '../../lib/usageTracking.js';
import { personalAccessKeyPrompt } from '../../lib/prompts/personalAccessKeyPrompt.js';
import { cliAccountNamePrompt } from '../../lib/prompts/accountNamePrompt.js';
import { setAsDefaultAccountPrompt } from '../../lib/prompts/setAsDefaultAccountPrompt.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { uiFeatureHighlight } from '../../lib/ui/index.js';
import { parseStringToNumber } from '../../lib/parsing.js';
import {
  CommonArgs,
  ConfigArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';

const TRACKING_STATUS = {
  STARTED: 'started',
  ERROR: 'error',
  COMPLETE: 'complete',
};
const authType = PERSONAL_ACCESS_KEY_AUTH_METHOD.value;

async function updateConfigWithNewAccount(
  env: Environment,
  configAlreadyExists: boolean,
  providedPersonalAccessKey?: string,
  accountId?: number
): Promise<CLIAccount | null> {
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
      updateAccountConfig({
        ...updatedConfig,
      });
      writeConfig();
    }

    return updatedConfig;
  } catch (e) {
    debugError(e);
    return null;
  }
}

async function handleConfigMigration(): Promise<boolean> {
  const deprecatedConfigExists = configFileExists(false);
  const globalConfigExists = configFileExists(true);

  // No deprecated config exists, so no migration is needed
  if (!deprecatedConfigExists) {
    return true;
  }

  // Global config exists, so we need to merge the deprecated config with the global config
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

  // Global config does not exist, so we only need to migrate the deprecated config
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

const describe = commands.account.subcommands.auth.describe;
const command = 'auth';

type AccountAuthArgs = CommonArgs &
  ConfigArgs & {
    disableTracking?: boolean;
  } & { personalAccessKey?: string };

async function handler(
  args: ArgumentsCamelCase<AccountAuthArgs>
): Promise<void> {
  const {
    disableTracking,
    personalAccessKey: providedPersonalAccessKey,
    userProvidedAccount,
  } = args;

  let parsedUserProvidedAccountId: number | undefined;

  if (userProvidedAccount) {
    try {
      parsedUserProvidedAccountId = parseStringToNumber(userProvidedAccount);
    } catch (err) {
      uiLogger.error(
        commands.account.subcommands.auth.errors.invalidAccountIdProvided
      );
      process.exit(EXIT_CODES.ERROR);
    }
  }

  if (!disableTracking) {
    trackCommandUsage('account-auth', {}, parsedUserProvidedAccountId);
    await trackAuthAction('account-auth', authType, TRACKING_STATUS.STARTED);
  }

  const configMigrationSuccess = await handleConfigMigration();

  if (!configMigrationSuccess) {
    await trackAuthAction('account-auth', authType, TRACKING_STATUS.ERROR);
    process.exit(EXIT_CODES.ERROR);
  }

  const configAlreadyExists = configFileExists(true);

  if (!configAlreadyExists) {
    createEmptyConfigFile({}, true);
  }

  loadConfig('');

  handleExit(deleteEmptyConfigFile);

  const updatedConfig = await updateConfigWithNewAccount(
    args.qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD,
    configAlreadyExists,
    providedPersonalAccessKey,
    parsedUserProvidedAccountId
  );

  if (!updatedConfig) {
    if (!disableTracking) {
      await trackAuthAction('account-auth', authType, TRACKING_STATUS.ERROR);
    }

    uiLogger.error(
      commands.account.subcommands.auth.errors.failedToUpdateConfig
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const accountId = getAccountIdentifier(updatedConfig);

  if (!configAlreadyExists) {
    uiLogger.log('');
    uiLogger.success(
      commands.account.subcommands.auth.success.configFileCreated(
        getConfigPath('', true)!
      )
    );
    uiLogger.success(
      commands.account.subcommands.auth.success.configFileUpdated(accountId!)
    );
  } else {
    await setAsDefaultAccountPrompt(updatedConfig.name!);
  }

  uiFeatureHighlight([
    'getStartedCommand',
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

function accountAuthBuilder(yargs: Argv): Argv<AccountAuthArgs> {
  yargs.options({
    account: {
      describe: commands.account.subcommands.auth.options.account,
      type: 'number',
      alias: 'a',
    },
    'disable-tracking': {
      type: 'boolean',
      hidden: true,
      default: false,
    },
    'personal-access-key': {
      describe: commands.account.subcommands.auth.options.personalAccessKey,
      type: 'string',
      hidden: false,
      alias: 'pak',
    },
  });

  return yargs as Argv<AccountAuthArgs>;
}

const builder = makeYargsBuilder<AccountAuthArgs>(
  accountAuthBuilder,
  command,
  commands.account.subcommands.auth.verboseDescribe,
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

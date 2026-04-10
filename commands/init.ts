import path from 'path';
import { existsSync } from 'fs';
import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  getConfigFilePath,
  createEmptyConfigFile,
  deleteConfigFileIfEmpty,
  setConfigAccountAsDefault,
  globalConfigFileExists,
} from '@hubspot/local-dev-lib/config';
import { Environment } from '@hubspot/local-dev-lib/types/Accounts';
import {
  OAUTH_AUTH_METHOD,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} from '@hubspot/local-dev-lib/constants/auth';
import { checkAndAddConfigToGitignore } from '@hubspot/local-dev-lib/gitignore';
import { DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME } from '@hubspot/local-dev-lib/constants/config';
import {
  getAccessToken,
  updateConfigWithAccessToken,
} from '@hubspot/local-dev-lib/personalAccessKey';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { toKebabCase } from '@hubspot/local-dev-lib/text';
import {
  HubSpotConfigAccount,
  OAuthConfigAccount,
} from '@hubspot/local-dev-lib/types/Accounts';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { setCLILogLevel } from '../lib/commonOpts.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { handleExit } from '../lib/process.js';
import { debugError, logError } from '../lib/errorHandlers/index.js';
import { isPromptExitError } from '../lib/errors/PromptExitError.js';
import { trackAuthAction } from '../lib/usageTracking.js';
import { promptUser } from '../lib/prompts/promptUtils.js';
import {
  OAUTH_FLOW,
  personalAccessKeyPrompt,
  OauthPromptResponse,
} from '../lib/prompts/personalAccessKeyPrompt.js';
import { cliAccountNamePrompt } from '../lib/prompts/accountNamePrompt.js';
import { authenticateWithOauth } from '../lib/oauth.js';
import { EXIT_CODES } from '../lib/enums/exitCodes.js';
import { uiCommandReference, uiFeatureHighlight } from '../lib/ui/index.js';
import {
  ConfigArgs,
  CommonArgs,
  TestingArgs,
  AccountArgs,
  YargsCommandModule,
} from '../types/Yargs.js';
import { makeYargsHandlerWithUsageTracking } from '../lib/yargs/makeYargsHandlerWithUsageTracking.js';
import { uiLogger } from '../lib/ui/logger.js';
import { commands } from '../lang/en.js';
import { parseStringToNumber } from '../lib/parsing.js';

const TRACKING_STATUS = {
  STARTED: 'started',
  ERROR: 'error',
  COMPLETE: 'complete',
};

async function personalAccessKeyConfigCreationFlow(
  env: Environment,
  account?: number
): Promise<HubSpotConfigAccount> {
  const { personalAccessKey } = await personalAccessKeyPrompt({ env, account });
  let updatedConfig: HubSpotConfigAccount;

  try {
    const token = await getAccessToken(personalAccessKey, env);
    const defaultName = token.hubName ? toKebabCase(token.hubName) : undefined;
    const { name } = await cliAccountNamePrompt(defaultName);

    updatedConfig = await updateConfigWithAccessToken(
      token,
      personalAccessKey,
      env,
      name,
      true
    );
  } catch (e) {
    logError(e);
  }

  return updatedConfig!;
}

async function oauthConfigCreationFlow(
  env: Environment
): Promise<OAuthConfigAccount> {
  const configData = await promptUser<OauthPromptResponse>(OAUTH_FLOW);

  const oauthAccount: OAuthConfigAccount = {
    name: configData.name,
    accountId: configData.accountId,
    authType: OAUTH_AUTH_METHOD.value,
    env,
    auth: {
      clientId: configData.clientId,
      clientSecret: configData.clientSecret,
      scopes: configData.scopes,
      tokenInfo: {},
    },
  };

  try {
    await authenticateWithOauth(oauthAccount);
    setConfigAccountAsDefault(configData.accountId);
  } catch (e) {
    logError(e);
    throw e;
  }

  return oauthAccount;
}

const AUTH_TYPE_NAMES = {
  [PERSONAL_ACCESS_KEY_AUTH_METHOD.value]: PERSONAL_ACCESS_KEY_AUTH_METHOD.name,
  [OAUTH_AUTH_METHOD.value]: OAUTH_AUTH_METHOD.name,
};

const command = 'init';
const describe = commands.init.describe;

type InitArgs = CommonArgs &
  ConfigArgs &
  TestingArgs &
  AccountArgs & {
    authType?: string;
    'disable-tracking'?: boolean;
    'use-hidden-config'?: boolean;
  };

async function handler(args: ArgumentsCamelCase<InitArgs>): Promise<void> {
  const {
    authType: authTypeFlagValue,
    c: configFlagValue,
    disableTracking,
    userProvidedAccount,
    exit,
    addUsageMetadata,
  } = args;

  let parsedUserProvidedAccountId;

  try {
    if (userProvidedAccount) {
      parsedUserProvidedAccountId = parseStringToNumber(userProvidedAccount);
    }
  } catch (err) {
    uiLogger.error(commands.init.errors.invalidAccountIdProvided);
    return exit(EXIT_CODES.ERROR);
  }

  const authType =
    (authTypeFlagValue && authTypeFlagValue.toLowerCase()) ||
    PERSONAL_ACCESS_KEY_AUTH_METHOD.value;

  let existingConfigPath: string | undefined;

  try {
    existingConfigPath =
      (configFlagValue && path.join(getCwd(), configFlagValue)) ||
      getConfigFilePath();
  } catch (err) {}

  setCLILogLevel(args);

  addUsageMetadata({ authType });

  const env = args.qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD;

  // Only check for global config if user is not providing a custom config path
  if (!configFlagValue && globalConfigFileExists()) {
    uiLogger.error(commands.init.errors.globalConfigFileExists);
    return exit(EXIT_CODES.ERROR);
  }

  // Check if the specific config file path already exists
  if (existingConfigPath && existsSync(existingConfigPath)) {
    uiLogger.error(commands.init.errors.configFileExists(existingConfigPath));
    uiLogger.info(commands.init.logs.updateConfig);
    return exit(EXIT_CODES.ERROR);
  }

  if (!disableTracking) {
    await trackAuthAction(
      'init',
      authType,
      TRACKING_STATUS.STARTED,
      parsedUserProvidedAccountId
    );
  }

  createEmptyConfigFile(false);

  handleExit(deleteConfigFileIfEmpty);

  try {
    let accountId: number;
    let name: string | undefined;
    if (authType === PERSONAL_ACCESS_KEY_AUTH_METHOD.value) {
      const personalAccessKeyResult = await personalAccessKeyConfigCreationFlow(
        env,
        parsedUserProvidedAccountId
      );
      accountId = personalAccessKeyResult.accountId;
      name = personalAccessKeyResult.name;
    } else {
      const oauthAccount = await oauthConfigCreationFlow(env);
      accountId = oauthAccount.accountId;
      name = oauthAccount.name;
    }

    const configPath = getConfigFilePath();

    try {
      checkAndAddConfigToGitignore(configPath);
    } catch (e) {
      debugError(e);
    }

    uiLogger.log('');
    uiLogger.success(commands.init.success.configFileCreated(configPath));
    uiLogger.success(
      commands.init.success.configFileUpdated(
        AUTH_TYPE_NAMES[authType as keyof typeof AUTH_TYPE_NAMES],
        name || accountId!
      )
    );
    uiFeatureHighlight([
      'getStartedCommand',
      'helpCommand',
      'authCommand',
      'accountsListCommand',
    ]);

    if (!disableTracking) {
      await trackAuthAction(
        'init',
        authType,
        TRACKING_STATUS.COMPLETE,
        accountId!
      );
    }
    return exit(EXIT_CODES.SUCCESS);
  } catch (err) {
    if (isPromptExitError(err)) {
      throw err;
    }
    logError(err);
    if (!disableTracking) {
      await trackAuthAction(
        'init',
        authType,
        TRACKING_STATUS.ERROR,
        parsedUserProvidedAccountId
      );
    }
    return exit(EXIT_CODES.ERROR);
  }
}

function initBuilder(yargs: Argv): Argv<InitArgs> {
  yargs.options({
    'auth-type': {
      describe: commands.init.options.authType.describe,
      type: 'string',
      choices: [
        `${PERSONAL_ACCESS_KEY_AUTH_METHOD.value}`,
        `${OAUTH_AUTH_METHOD.value}`,
      ],
      default: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
    },
    account: {
      describe: commands.init.options.account.describe,
      type: 'string',
      alias: 'a',
    },
    'disable-tracking': {
      type: 'boolean',
      hidden: true,
      default: false,
    },
  });

  yargs.conflicts('use-hidden-config', 'config');

  return yargs as Argv<InitArgs>;
}

const builder = makeYargsBuilder<InitArgs>(
  initBuilder,
  command,
  commands.init.verboseDescribe(
    DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
    uiCommandReference('hs auth'),
    PERSONAL_ACCESS_KEY_AUTH_METHOD.value
  ),
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useTestingOptions: true,
  }
);

const initCommand: YargsCommandModule<unknown, InitArgs> = {
  command,
  describe,
  handler: makeYargsHandlerWithUsageTracking('init', handler),
  builder,
};

export default initCommand;

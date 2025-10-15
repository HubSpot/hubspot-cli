import { Argv, ArgumentsCamelCase } from 'yargs';
import { checkAndWarnGitInclusion } from '../lib/ui/git.js';
import {
  OAUTH_AUTH_METHOD,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} from '@hubspot/local-dev-lib/constants/auth';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME } from '@hubspot/local-dev-lib/constants/config';
import { AccessToken, CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import {
  getAccessToken,
  updateConfigWithAccessToken,
} from '@hubspot/local-dev-lib/personalAccessKey';
import {
  updateAccountConfig,
  writeConfig,
  getConfigPath,
  loadConfig,
  getAccountId,
  configFileExists,
} from '@hubspot/local-dev-lib/config';
import { commaSeparatedValues, toKebabCase } from '@hubspot/local-dev-lib/text';
import { promptUser } from '../lib/prompts/promptUtils.js';
import {
  personalAccessKeyPrompt,
  OAUTH_FLOW,
  OauthPromptResponse,
} from '../lib/prompts/personalAccessKeyPrompt.js';
import { cliAccountNamePrompt } from '../lib/prompts/accountNamePrompt.js';
import { setAsDefaultAccountPrompt } from '../lib/prompts/setAsDefaultAccountPrompt.js';
import { setCLILogLevel } from '../lib/commonOpts.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { trackAuthAction, trackCommandUsage } from '../lib/usageTracking.js';
import { authenticateWithOauth } from '../lib/oauth.js';
import { EXIT_CODES } from '../lib/enums/exitCodes.js';
import { uiFeatureHighlight } from '../lib/ui/index.js';
import { logError } from '../lib/errorHandlers/index.js';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  TestingArgs,
  YargsCommandModule,
} from '../types/Yargs.js';
import { commands } from '../lang/en.js';
import { uiLogger } from '../lib/ui/logger.js';
import { parseStringToNumber } from '../lib/parsing.js';

const TRACKING_STATUS = {
  STARTED: 'started',
  ERROR: 'error',
  COMPLETE: 'complete',
};

const ALLOWED_AUTH_METHODS = [
  OAUTH_AUTH_METHOD.value,
  PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
];
const SUPPORTED_AUTHENTICATION_PROTOCOLS_TEXT =
  commaSeparatedValues(ALLOWED_AUTH_METHODS);

const command = 'auth';
const describe = commands.auth.describe;

type AuthArgs = CommonArgs &
  ConfigArgs &
  TestingArgs &
  AccountArgs & {
    authType?: string;
    disableTracking: boolean;
  } & { personalAccessKey?: string };

async function handler(args: ArgumentsCamelCase<AuthArgs>): Promise<void> {
  const {
    authType: authTypeFlagValue,
    config: configFlagValue,
    qa,
    personalAccessKey: providedPersonalAccessKey,
    userProvidedAccount,
    disableTracking,
  } = args;

  let parsedUserProvidedAccountId;

  try {
    if (userProvidedAccount) {
      parsedUserProvidedAccountId = parseStringToNumber(userProvidedAccount);
    }
  } catch (err) {
    uiLogger.error(commands.auth.errors.invalidAccountIdProvided);
    process.exit(EXIT_CODES.ERROR);
  }

  const authType =
    (authTypeFlagValue && authTypeFlagValue.toLowerCase()) ||
    PERSONAL_ACCESS_KEY_AUTH_METHOD.value;
  setCLILogLevel(args);

  const env = qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD;
  // Needed to load deprecated config
  loadConfig(configFlagValue!);
  const configPath = getConfigPath();
  if (configPath) {
    checkAndWarnGitInclusion(configPath);
  }

  if (configFileExists(true)) {
    uiLogger.error(
      commands.auth.errors.globalConfigFileExists('hs account auth')
    );
    process.exit(EXIT_CODES.ERROR);
  }

  if (!disableTracking) {
    trackCommandUsage('auth');
    trackAuthAction(
      'auth',
      authType,
      TRACKING_STATUS.STARTED,
      parsedUserProvidedAccountId
    );
  }

  let configData: OauthPromptResponse | undefined;
  let updatedConfig: CLIAccount | null | undefined;
  let validName: string | undefined;
  let successAuthMethod: string | undefined;
  let token: AccessToken | undefined;
  let defaultName: string | undefined;

  switch (authType) {
    case OAUTH_AUTH_METHOD.value:
      configData = await promptUser<OauthPromptResponse>(OAUTH_FLOW);
      await authenticateWithOauth({
        ...configData,
        env,
      });
      successAuthMethod = OAUTH_AUTH_METHOD.name;
      break;
    case PERSONAL_ACCESS_KEY_AUTH_METHOD.value:
      const { personalAccessKey } = providedPersonalAccessKey
        ? { personalAccessKey: providedPersonalAccessKey }
        : await personalAccessKeyPrompt({
            env,
            account: parsedUserProvidedAccountId,
          });

      try {
        token = await getAccessToken(personalAccessKey, env);
        defaultName = token.hubName ? toKebabCase(token.hubName) : undefined;

        updatedConfig = await updateConfigWithAccessToken(
          token,
          personalAccessKey,
          env
        );
      } catch (e) {
        logError(e);
      }

      if (!updatedConfig) {
        break;
      }

      validName = updatedConfig.name;

      if (!validName) {
        const { name: namePrompt } = await cliAccountNamePrompt(defaultName);
        validName = namePrompt;
      }

      updateAccountConfig({
        ...updatedConfig,
        env: updatedConfig.env,
        tokenInfo: updatedConfig.auth!.tokenInfo,
        name: validName,
      });
      writeConfig();

      successAuthMethod = PERSONAL_ACCESS_KEY_AUTH_METHOD.name;
      break;
    default:
      uiLogger.error(
        commands.auth.errors.unsupportedAuthType(
          authType,
          SUPPORTED_AUTHENTICATION_PROTOCOLS_TEXT
        )
      );
      break;
  }

  if (!successAuthMethod && !disableTracking) {
    await trackAuthAction(
      'auth',
      authType,
      TRACKING_STATUS.ERROR,
      parsedUserProvidedAccountId
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const nameFromConfigData =
    configData && 'name' in configData ? configData.name : undefined;

  const accountName =
    (updatedConfig && updatedConfig.name) || validName || nameFromConfigData!;

  await setAsDefaultAccountPrompt(accountName);

  uiLogger.success(
    commands.auth.success.configFileUpdated(
      accountName,
      DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
      successAuthMethod!
    )
  );
  uiFeatureHighlight([
    'getStartedCommand',
    'accountsUseCommand',
    'accountOption',
    'accountsListCommand',
  ]);

  const accountId = getAccountId(accountName) || undefined;

  if (!disableTracking) {
    await trackAuthAction(
      'auth',
      authType,
      TRACKING_STATUS.COMPLETE,
      accountId
    );
  }

  process.exit(EXIT_CODES.SUCCESS);
}

function authBuilder(yargs: Argv): Argv<AuthArgs> {
  yargs.options({
    'auth-type': {
      describe: commands.auth.options.authType.describe,
      type: 'string',
      choices: [
        `${PERSONAL_ACCESS_KEY_AUTH_METHOD.value}`,
        `${OAUTH_AUTH_METHOD.value}`,
      ],
      default: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
    },
    account: {
      describe: commands.auth.options.account.describe,
      type: 'string',
      alias: 'a',
    },
    'personal-access-key': {
      describe: commands.auth.options.personalAccessKey.describe,
      type: 'string',
      hidden: false,
      alias: 'pak',
    },
    'disable-tracking': {
      type: 'boolean',
      hidden: true,
      default: false,
    },
  });

  return yargs as Argv<AuthArgs>;
}

const builder = makeYargsBuilder<AuthArgs>(
  authBuilder,
  command,
  commands.auth.verboseDescribe(
    PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
    DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME
  ),
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useTestingOptions: true,
  }
);

const authCommand: YargsCommandModule<unknown, AuthArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default authCommand;

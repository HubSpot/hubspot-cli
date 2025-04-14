import { Argv, ArgumentsCamelCase } from 'yargs';
import { checkAndWarnGitInclusion } from '../lib/ui/git';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  OAUTH_AUTH_METHOD,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} from '@hubspot/local-dev-lib/constants/auth';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME } from '@hubspot/local-dev-lib/constants/config';
import {
  AccessToken,
  HubSpotConfigAccount,
} from '@hubspot/local-dev-lib/types/Accounts';
import { i18n } from '../lib/lang';
import {
  getAccessToken,
  updateConfigWithAccessToken,
} from '@hubspot/local-dev-lib/personalAccessKey';
import {
  updateConfigAccount,
  getConfigFilePath,
  getConfigDefaultAccountIfExists,
  getConfigAccountByName,
} from '@hubspot/local-dev-lib/config';
import { commaSeparatedValues, toKebabCase } from '@hubspot/local-dev-lib/text';
import { promptUser } from '../lib/prompts/promptUtils';
import {
  personalAccessKeyPrompt,
  OAUTH_FLOW,
  OauthPromptResponse,
  PersonalAccessKeyPromptResponse,
} from '../lib/prompts/personalAccessKeyPrompt';
import { cliAccountNamePrompt } from '../lib/prompts/accountNamePrompt';
import { setAsDefaultAccountPrompt } from '../lib/prompts/setAsDefaultAccountPrompt';
import { setLogLevel } from '../lib/commonOpts';
import { makeYargsBuilder } from '../lib/yargsUtils';
import { trackAuthAction, trackCommandUsage } from '../lib/usageTracking';
import { authenticateWithOauth } from '../lib/oauth';
import { EXIT_CODES } from '../lib/enums/exitCodes';
import { uiFeatureHighlight } from '../lib/ui';
import { logError } from '../lib/errorHandlers/index';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  TestingArgs,
} from '../types/Yargs';

const i18nKey = 'commands.auth';

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

export const command = 'auth';
export const describe = i18n(`${i18nKey}.describe`);

type AuthArgs = CommonArgs &
  ConfigArgs &
  TestingArgs &
  AccountArgs & {
    authType?: string;
  };

export async function handler(
  args: ArgumentsCamelCase<AuthArgs>
): Promise<void> {
  const { authType: authTypeFlagValue, qa, providedAccountId } = args;
  const authType =
    (authTypeFlagValue && authTypeFlagValue.toLowerCase()) ||
    PERSONAL_ACCESS_KEY_AUTH_METHOD.value;
  setLogLevel(args);

  const env = qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD;

  const configPath = getConfigFilePath();
  checkAndWarnGitInclusion(configPath);

  trackCommandUsage('auth');
  trackAuthAction('auth', authType, TRACKING_STATUS.STARTED, providedAccountId);

  let accountPromptData: OauthPromptResponse | PersonalAccessKeyPromptResponse;
  let updatedAccount: HubSpotConfigAccount | undefined;
  let successAuthMethod: string | undefined;
  let token: AccessToken | undefined;
  let defaultName: string | undefined;

  switch (authType) {
    case OAUTH_AUTH_METHOD.value:
      accountPromptData = await promptUser<OauthPromptResponse>(OAUTH_FLOW);
      await authenticateWithOauth(accountPromptData, env);
      successAuthMethod = OAUTH_AUTH_METHOD.name;
      break;
    case PERSONAL_ACCESS_KEY_AUTH_METHOD.value:
      accountPromptData = await personalAccessKeyPrompt({
        env,
        account: providedAccountId,
      });

      try {
        token = await getAccessToken(accountPromptData.personalAccessKey, env);
        defaultName = toKebabCase(token.hubName);

        updatedAccount = await updateConfigWithAccessToken(
          token,
          accountPromptData.personalAccessKey,
          env
        );
      } catch (e) {
        logError(e);
      }

      if (!updatedAccount) {
        break;
      }

      if (!updatedAccount.name) {
        const { name: namePrompt } = await cliAccountNamePrompt(defaultName);
        updatedAccount.name = namePrompt;
      }

      updateConfigAccount({
        ...updatedAccount,
      });

      successAuthMethod = PERSONAL_ACCESS_KEY_AUTH_METHOD.name;
      break;
    default:
      logger.error(
        i18n(`${i18nKey}.errors.unsupportedAuthType`, {
          supportedProtocols: SUPPORTED_AUTHENTICATION_PROTOCOLS_TEXT,
          type: authType,
        })
      );
      process.exit(EXIT_CODES.ERROR);
  }

  if (!successAuthMethod) {
    await trackAuthAction(
      'auth',
      authType,
      TRACKING_STATUS.ERROR,
      providedAccountId
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const nameFromPromptData =
    'name' in accountPromptData ? accountPromptData.name : undefined;

  // Name will always exist on either the updatedAccount or prompt response
  const accountName = (updatedAccount?.name || nameFromPromptData)!;

  const setAsDefault = await setAsDefaultAccountPrompt(accountName);

  logger.log('');
  if (setAsDefault) {
    logger.success(
      i18n(`lib.prompts.setAsDefaultAccountPrompt.setAsDefaultAccount`, {
        accountName,
      })
    );
  } else {
    logger.info(
      i18n(`lib.prompts.setAsDefaultAccountPrompt.keepingCurrentDefault`, {
        accountName: getConfigDefaultAccountIfExists()?.name || '',
      })
    );
  }
  logger.success(
    i18n(`${i18nKey}.success.configFileUpdated`, {
      configFilename: DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
      authType: successAuthMethod,
      accountName,
    })
  );
  uiFeatureHighlight([
    'accountsUseCommand',
    'accountOption',
    'accountsListCommand',
  ]);

  const account = getConfigAccountByName(accountName);
  await trackAuthAction(
    'auth',
    authType,
    TRACKING_STATUS.COMPLETE,
    account.accountId
  );

  process.exit(EXIT_CODES.SUCCESS);
}

function authBuilder(yargs: Argv): Argv<AuthArgs> {
  yargs.options({
    'auth-type': {
      describe: i18n(`${i18nKey}.options.authType.describe`),
      type: 'string',
      choices: [
        `${PERSONAL_ACCESS_KEY_AUTH_METHOD.value}`,
        `${OAUTH_AUTH_METHOD.value}`,
      ],
      default: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
    },
    account: {
      describe: i18n(`${i18nKey}.options.account.describe`),
      type: 'string',
      alias: 'a',
    },
  });

  return yargs as Argv<AuthArgs>;
}

export const builder = makeYargsBuilder<AuthArgs>(
  authBuilder,
  command,
  i18n(`${i18nKey}.verboseDescribe`, {
    authMethod: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
    configName: DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  }),
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useTestingOptions: true,
  }
);

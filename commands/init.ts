import path from 'path';
import { ArgumentsCamelCase, Argv } from 'yargs';
import fs from 'fs-extra';
import {
  getConfigPath,
  createEmptyConfigFile,
  deleteEmptyConfigFile,
  updateDefaultAccount,
  loadConfig,
  configFileExists,
} from '@hubspot/local-dev-lib/config';
import { Environment } from '@hubspot/local-dev-lib/types/Config';
import { OAuth2ManagerAccountConfig } from '@hubspot/local-dev-lib/types/Accounts';
import { addConfigOptions, addGlobalOptions } from '../lib/commonOpts';
import { handleExit } from '../lib/process';
import { checkAndAddConfigToGitignore } from '@hubspot/local-dev-lib/gitignore';
import { debugError, logError } from '../lib/errorHandlers/index';
import {
  OAUTH_AUTH_METHOD,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} from '@hubspot/local-dev-lib/constants/auth';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME } from '@hubspot/local-dev-lib/constants/config';
import { i18n } from '../lib/lang';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  getAccessToken,
  updateConfigWithAccessToken,
} from '@hubspot/local-dev-lib/personalAccessKey';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { toKebabCase } from '@hubspot/local-dev-lib/text';
import { trackCommandUsage, trackAuthAction } from '../lib/usageTracking';
import { setLogLevel, addTestingOptions } from '../lib/commonOpts';
import { promptUser } from '../lib/prompts/promptUtils';
import {
  OAUTH_FLOW,
  personalAccessKeyPrompt,
  OauthPromptResponse,
} from '../lib/prompts/personalAccessKeyPrompt';
import { cliAccountNamePrompt } from '../lib/prompts/accountNamePrompt';
import { authenticateWithOauth } from '../lib/oauth';
import { EXIT_CODES } from '../lib/enums/exitCodes';
import { uiFeatureHighlight } from '../lib/ui';
import { ConfigArgs, CommonArgs, TestingArgs } from '../types/Yargs';
import { getAccountIdentifier } from '@hubspot/local-dev-lib/config/getAccountIdentifier';
import { CLIOptions } from '@hubspot/local-dev-lib/types/CLIOptions';

const i18nKey = 'commands.init';

const TRACKING_STATUS = {
  STARTED: 'started',
  ERROR: 'error',
  COMPLETE: 'complete',
};

async function personalAccessKeyConfigCreationFlow(
  env: Environment,
  account?: number
) {
  const { personalAccessKey } = await personalAccessKeyPrompt({ env, account });
  let updatedConfig;

  try {
    const token = await getAccessToken(personalAccessKey, env);
    const defaultName = token.hubName ? toKebabCase(token.hubName) : undefined;
    const { name } = await cliAccountNamePrompt(defaultName);

    updatedConfig = updateConfigWithAccessToken(
      token,
      personalAccessKey,
      env,
      name,
      true
    );
  } catch (e) {
    logError(e);
  }
  return updatedConfig;
}

async function oauthConfigCreationFlow(env: Environment) {
  const configData = await promptUser<OauthPromptResponse>(OAUTH_FLOW);
  const accountConfig: OAuth2ManagerAccountConfig = {
    ...configData,
    env,
  };
  await authenticateWithOauth(accountConfig);
  updateDefaultAccount(accountConfig.name!);
  return accountConfig;
}

const AUTH_TYPE_NAMES = {
  [PERSONAL_ACCESS_KEY_AUTH_METHOD.value]: PERSONAL_ACCESS_KEY_AUTH_METHOD.name,
  [OAUTH_AUTH_METHOD.value]: OAUTH_AUTH_METHOD.name,
};

export const command = 'init';
export const describe = i18n(`${i18nKey}.describe`, {
  configName: DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
});

type InitArgs = CommonArgs &
  ConfigArgs &
  TestingArgs & {
    authType?: string;
    account?: string;
    'disable-tracking'?: boolean;
    'use-hidden-config'?: boolean;
  };

export async function handler(
  args: ArgumentsCamelCase<InitArgs>
): Promise<void> {
  const {
    authType: authTypeFlagValue,
    c: configFlagValue,
    providedAccountId,
    disableTracking,
    useHiddenConfig,
  } = args;
  const authType =
    (authTypeFlagValue && authTypeFlagValue.toLowerCase()) ||
    PERSONAL_ACCESS_KEY_AUTH_METHOD.value;

  const configPath =
    (configFlagValue && path.join(getCwd(), configFlagValue)) ||
    getConfigPath('', useHiddenConfig);
  setLogLevel(args);

  if (!disableTracking) {
    trackCommandUsage('init', {
      authType,
    });
  }

  const env = args.qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD;

  if (fs.existsSync(configPath!)) {
    logger.error(
      i18n(`${i18nKey}.errors.configFileExists`, {
        configPath: configPath!,
      })
    );
    logger.info(i18n(`${i18nKey}.logs.updateConfig`));
    process.exit(EXIT_CODES.ERROR);
  }

  if (!disableTracking) {
    await trackAuthAction(
      'init',
      authType,
      TRACKING_STATUS.STARTED,
      providedAccountId!
    );
  }

  const doesOtherConfigFileExist = configFileExists(!useHiddenConfig);
  if (doesOtherConfigFileExist) {
    const path = getConfigPath('', !useHiddenConfig);
    logger.error(
      i18n(`${i18nKey}.errors.bothConfigFilesNotAllowed`, { path: path! })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  trackAuthAction(
    'init',
    authType,
    TRACKING_STATUS.STARTED,
    providedAccountId!
  );
  createEmptyConfigFile({ path: configPath! }, useHiddenConfig);
  //Needed to load deprecated config
  loadConfig(configPath!, args as CLIOptions);

  handleExit(deleteEmptyConfigFile);

  try {
    let accountId: number;
    let name;
    if (authType === PERSONAL_ACCESS_KEY_AUTH_METHOD.value) {
      const personalAccessKeyResult = await personalAccessKeyConfigCreationFlow(
        env,
        providedAccountId
      );
      if (personalAccessKeyResult) {
        accountId = getAccountIdentifier(personalAccessKeyResult)!;
        name = personalAccessKeyResult.name;
      }
    } else {
      const oauthResult = await oauthConfigCreationFlow(env);
      accountId = oauthResult.accountId!;
      name = oauthResult.name;
    }

    try {
      checkAndAddConfigToGitignore(configPath!);
    } catch (e) {
      debugError(e);
    }

    let newConfigPath = configPath;
    if (!newConfigPath && !useHiddenConfig) {
      newConfigPath = `${getCwd()}/${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME}`;
    }

    logger.log('');
    logger.success(
      i18n(`${i18nKey}.success.configFileCreated`, {
        configPath: newConfigPath!,
      })
    );
    logger.success(
      i18n(`${i18nKey}.success.configFileUpdated`, {
        authType: AUTH_TYPE_NAMES[authType as keyof typeof AUTH_TYPE_NAMES],
        account: name || accountId!,
      })
    );
    uiFeatureHighlight(['helpCommand', 'authCommand', 'accountsListCommand']);

    if (!disableTracking) {
      await trackAuthAction(
        'init',
        authType,
        TRACKING_STATUS.COMPLETE,
        accountId!
      );
    }
    process.exit(EXIT_CODES.SUCCESS);
  } catch (err) {
    logError(err);
    if (!disableTracking) {
      await trackAuthAction(
        'init',
        authType,
        TRACKING_STATUS.ERROR,
        providedAccountId!
      );
    }
    process.exit(EXIT_CODES.ERROR);
  }
}

export function builder(yargs: Argv): Argv<InitArgs> {
  addConfigOptions(yargs);
  addTestingOptions(yargs);
  addGlobalOptions(yargs);

  yargs.options({
    'auth-type': {
      describe: i18n(`${i18nKey}.options.authType.describe`),
      type: 'string',
      choices: [
        `${PERSONAL_ACCESS_KEY_AUTH_METHOD.value}`,
        `${OAUTH_AUTH_METHOD.value}`,
      ],
      default: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
      defaultDescription: i18n(
        `${i18nKey}.options.authType.defaultDescription`,
        {
          authMethod: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
        }
      ),
    },
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
    'use-hidden-config': {
      describe: i18n(`${i18nKey}.options.useHiddenConfig.describe`),
      hidden: true,
      type: 'boolean',
    },
  });

  yargs.conflicts('use-hidden-config', 'config');

  return yargs as Argv<InitArgs>;
}

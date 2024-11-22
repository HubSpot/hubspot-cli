// @ts-nocheck
const path = require('path');
const fs = require('fs-extra');
const {
  getConfigPath,
  createEmptyConfigFile,
  deleteEmptyConfigFile,
  updateDefaultAccount,
  loadConfig,
  configFileExists,
} = require('@hubspot/local-dev-lib/config');
const { addConfigOptions } = require('../lib/commonOpts');
const { handleExit } = require('../lib/process');
const {
  checkAndAddConfigToGitignore,
} = require('@hubspot/local-dev-lib/gitignore');
const { debugError, logError } = require('../lib/errorHandlers/index');
const {
  OAUTH_AUTH_METHOD,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} = require('@hubspot/local-dev-lib/constants/auth');
const {
  ENVIRONMENTS,
} = require('@hubspot/local-dev-lib/constants/environments');
const {
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
} = require('@hubspot/local-dev-lib/constants/config');
const { i18n } = require('../lib/lang');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  getAccessToken,
  updateConfigWithAccessToken,
} = require('@hubspot/local-dev-lib/personalAccessKey');
const { getCwd } = require('@hubspot/local-dev-lib/path');
const { toKebabCase } = require('@hubspot/local-dev-lib/text');
const { trackCommandUsage, trackAuthAction } = require('../lib/usageTracking');
const { setLogLevel, addTestingOptions } = require('../lib/commonOpts');
const { promptUser } = require('../lib/prompts/promptUtils');
const {
  OAUTH_FLOW,
  personalAccessKeyPrompt,
} = require('../lib/prompts/personalAccessKeyPrompt');
const { cliAccountNamePrompt } = require('../lib/prompts/accountNamePrompt');
const { authenticateWithOauth } = require('../lib/oauth');
const { EXIT_CODES } = require('../lib/enums/exitCodes');
const { uiFeatureHighlight } = require('../lib/ui');

const i18nKey = 'commands.init';

const TRACKING_STATUS = {
  STARTED: 'started',
  ERROR: 'error',
  COMPLETE: 'complete',
};

const personalAccessKeyConfigCreationFlow = async (env, account) => {
  const { personalAccessKey } = await personalAccessKeyPrompt({ env, account });
  let updatedConfig;

  try {
    const token = await getAccessToken(personalAccessKey, env);
    const defaultName = token.hubName ? toKebabCase(token.hubName) : null;
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
};

const oauthConfigCreationFlow = async env => {
  const configData = await promptUser(OAUTH_FLOW);
  const accountConfig = {
    ...configData,
    env,
  };
  await authenticateWithOauth(accountConfig);
  updateDefaultAccount(accountConfig.name);
  return accountConfig;
};

const CONFIG_CREATION_FLOWS = {
  [PERSONAL_ACCESS_KEY_AUTH_METHOD.value]: personalAccessKeyConfigCreationFlow,
  [OAUTH_AUTH_METHOD.value]: oauthConfigCreationFlow,
};

const AUTH_TYPE_NAMES = {
  [PERSONAL_ACCESS_KEY_AUTH_METHOD.value]: PERSONAL_ACCESS_KEY_AUTH_METHOD.name,
  [OAUTH_AUTH_METHOD.value]: OAUTH_AUTH_METHOD.name,
};

exports.command = 'init';
exports.describe = i18n(`${i18nKey}.describe`, {
  configName: DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
});

exports.handler = async options => {
  const {
    auth: authTypeFlagValue,
    c: configFlagValue,
    providedAccountId,
    disableTracking,
    useHiddenConfig,
  } = options;
  const authType =
    (authTypeFlagValue && authTypeFlagValue.toLowerCase()) ||
    PERSONAL_ACCESS_KEY_AUTH_METHOD.value;

  const configPath =
    (configFlagValue && path.join(getCwd(), configFlagValue)) ||
    getConfigPath('', useHiddenConfig);
  setLogLevel(options);

  if (!disableTracking) {
    trackCommandUsage('init', {
      authType,
    });
  }

  const env = options.qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD;

  if (fs.existsSync(configPath)) {
    logger.error(
      i18n(`${i18nKey}.errors.configFileExists`, {
        configPath,
      })
    );
    logger.info(i18n(`${i18nKey}.logs.updateConfig`));
    process.exit(EXIT_CODES.ERROR);
  }

  if (!disableTracking) {
    await trackAuthAction('init', authType, TRACKING_STATUS.STARTED);
  }

  const doesOtherConfigFileExist = configFileExists(!useHiddenConfig);
  if (doesOtherConfigFileExist) {
    const path = getConfigPath('', !useHiddenConfig);
    logger.error(i18n(`${i18nKey}.errors.bothConfigFilesNotAllowed`, { path }));
    process.exit(EXIT_CODES.ERROR);
  }

  trackAuthAction('init', authType, TRACKING_STATUS.STARTED);
  createEmptyConfigFile({ path: configPath }, useHiddenConfig);
  //Needed to load deprecated config
  loadConfig(configPath, options);

  handleExit(deleteEmptyConfigFile);

  try {
    const { accountId, name } = await CONFIG_CREATION_FLOWS[authType](
      env,
      providedAccountId
    );

    try {
      checkAndAddConfigToGitignore(configPath);
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
        configPath: newConfigPath,
      })
    );
    logger.success(
      i18n(`${i18nKey}.success.configFileUpdated`, {
        authType: AUTH_TYPE_NAMES[authType],
        account: name || accountId,
      })
    );
    uiFeatureHighlight(['helpCommand', 'authCommand', 'accountsListCommand']);

    if (!disableTracking) {
      await trackAuthAction(
        'init',
        authType,
        TRACKING_STATUS.COMPLETE,
        accountId
      );
    }
    process.exit(EXIT_CODES.SUCCESS);
  } catch (err) {
    logError(err);
    if (!disableTracking) {
      await trackAuthAction('init', authType, TRACKING_STATUS.ERROR);
    }
    process.exit(EXIT_CODES.ERROR);
  }
};

exports.builder = yargs => {
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
          defaultType: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
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
      type: 'boolean',
    },
  });

  addConfigOptions(yargs);
  addTestingOptions(yargs);

  return yargs;
};

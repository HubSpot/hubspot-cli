const path = require('path');
const fs = require('fs-extra');
const {
  getConfigPath,
  createEmptyConfigFile,
  deleteEmptyConfigFile,
  updateDefaultAccount,
  writeConfig,
  updateAccountConfig,
} = require('@hubspot/cli-lib/lib/config');
const { addConfigOptions } = require('../lib/commonOpts');
const { handleExit } = require('@hubspot/cli-lib/lib/process');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');
const {
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
  OAUTH_AUTH_METHOD,
  API_KEY_AUTH_METHOD,
  ENVIRONMENTS,
} = require('@hubspot/cli-lib/lib/constants');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  updateConfigWithPersonalAccessKey,
} = require('@hubspot/cli-lib/personalAccessKey');
const { getCwd } = require('@hubspot/cli-lib/path');
const { trackCommandUsage, trackAuthAction } = require('../lib/usageTracking');
const { setLogLevel, addTestingOptions } = require('../lib/commonOpts');
const {
  OAUTH_FLOW,
  API_KEY_FLOW,
  ACCOUNT_NAME,
  personalAccessKeyPrompt,
  promptUser,
} = require('../lib/prompts');
const { logDebugInfo } = require('../lib/debugInfo');
const { authenticateWithOauth } = require('../lib/oauth');

const i18nKey = 'cli.commands.init';

const TRACKING_STATUS = {
  STARTED: 'started',
  ERROR: 'error',
  COMPLETE: 'complete',
};

const personalAccessKeyConfigCreationFlow = async env => {
  const configData = await personalAccessKeyPrompt({ env });
  const { name } = await promptUser([ACCOUNT_NAME]);
  const accountConfig = {
    ...configData,
    name,
  };

  return updateConfigWithPersonalAccessKey(accountConfig, true);
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

const apiKeyConfigCreationFlow = async env => {
  const configData = await promptUser(API_KEY_FLOW);
  const accountConfig = {
    ...configData,
    env,
  };
  updateAccountConfig(accountConfig);
  updateDefaultAccount(accountConfig.name);
  writeConfig();
  return accountConfig;
};

const CONFIG_CREATION_FLOWS = {
  [PERSONAL_ACCESS_KEY_AUTH_METHOD.value]: personalAccessKeyConfigCreationFlow,
  [OAUTH_AUTH_METHOD.value]: oauthConfigCreationFlow,
  [API_KEY_AUTH_METHOD.value]: apiKeyConfigCreationFlow,
};

exports.command = 'init';
exports.describe = i18n(`${i18nKey}.describe`, {
  configName: DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
});

exports.handler = async options => {
  const { auth: authType = PERSONAL_ACCESS_KEY_AUTH_METHOD.value, c } = options;
  const configPath = (c && path.join(getCwd(), c)) || getConfigPath();
  setLogLevel(options);
  logDebugInfo(options);
  trackCommandUsage('init', {
    authType,
  });
  const env = options.qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD;

  if (fs.existsSync(configPath)) {
    logger.error(
      i18n(`${i18nKey}.errors.configFileExists`, {
        configPath,
      })
    );
    logger.info(i18n(`${i18nKey}.info.updateConfig`));
    process.exit(1);
  }

  trackAuthAction('init', authType, TRACKING_STATUS.STARTED);
  createEmptyConfigFile({ path: configPath });
  handleExit(deleteEmptyConfigFile);

  try {
    const { accountId, name } = await CONFIG_CREATION_FLOWS[authType](env);
    const configPath = getConfigPath();

    logger.success(
      i18n(`${i18nKey}.success.configFileCreated`, {
        configPath,
        authType,
        account: name || accountId,
      })
    );

    trackAuthAction('init', authType, TRACKING_STATUS.COMPLETE, accountId);
    process.exit();
  } catch (err) {
    logErrorInstance(err);
    trackAuthAction('init', authType, TRACKING_STATUS.ERROR);
  }
};

exports.builder = yargs => {
  yargs.option('auth', {
    describe: i18n(`${i18nKey}.options.auth.describe`),
    type: 'string',
    choices: [
      `${PERSONAL_ACCESS_KEY_AUTH_METHOD.value}`,
      `${OAUTH_AUTH_METHOD.value}`,
      `${API_KEY_AUTH_METHOD.value}`,
    ],
    default: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
    defaultDescription: i18n(`${i18nKey}.options.auth.defaultDescription`, {
      defaultType: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
    }),
  });

  addConfigOptions(yargs, true);
  addTestingOptions(yargs, true);

  return yargs;
};

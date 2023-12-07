const path = require('path');
const fs = require('fs-extra');
const {
  getConfigPath,
  createEmptyConfigFile,
  deleteEmptyConfigFile,
  updateDefaultAccount,
} = require('@hubspot/local-dev-lib/config');
const { addConfigOptions } = require('../lib/commonOpts');
const { handleExit } = require('../lib/process');
const {
  checkAndAddConfigToGitignore,
} = require('@hubspot/local-dev-lib/gitignore');
const {
  logErrorInstance,
  debugErrorAndContext,
} = require('../lib/errorHandlers/standardErrors');
const {
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
  OAUTH_AUTH_METHOD,
  ENVIRONMENTS,
} = require('@hubspot/cli-lib/lib/constants');
const { i18n } = require('../lib/lang');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  updateConfigWithPersonalAccessKey,
} = require('@hubspot/cli-lib/personalAccessKey');
const { getCwd } = require('@hubspot/local-dev-lib/path');
const { trackCommandUsage, trackAuthAction } = require('../lib/usageTracking');
const { setLogLevel, addTestingOptions } = require('../lib/commonOpts');
const { promptUser } = require('../lib/prompts/promptUtils');
const {
  OAUTH_FLOW,
  personalAccessKeyPrompt,
} = require('../lib/prompts/personalAccessKeyPrompt');
const {
  enterAccountNamePrompt,
} = require('../lib/prompts/enterAccountNamePrompt');
const { logDebugInfo } = require('../lib/debugInfo');
const { authenticateWithOauth } = require('../lib/oauth');
const { EXIT_CODES } = require('../lib/enums/exitCodes');
const { uiFeatureHighlight } = require('../lib/ui');

const i18nKey = 'cli.commands.init';

const TRACKING_STATUS = {
  STARTED: 'started',
  ERROR: 'error',
  COMPLETE: 'complete',
};

const personalAccessKeyConfigCreationFlow = async (env, account) => {
  const configData = await personalAccessKeyPrompt({ env, account });
  const { name } = await enterAccountNamePrompt();
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

const CONFIG_CREATION_FLOWS = {
  [PERSONAL_ACCESS_KEY_AUTH_METHOD.value]: personalAccessKeyConfigCreationFlow,
  [OAUTH_AUTH_METHOD.value]: oauthConfigCreationFlow,
};

const AUTH_TYPE_NAMES = {
  [PERSONAL_ACCESS_KEY_AUTH_METHOD.value]: PERSONAL_ACCESS_KEY_AUTH_METHOD.name,
  [OAUTH_AUTH_METHOD.value]: OAUTH_AUTH_METHOD.name,
};

exports.command = 'init [--account]';
exports.describe = i18n(`${i18nKey}.describe`, {
  configName: DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
});

exports.handler = async options => {
  const {
    auth: authType = PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
    c,
    account: optionalAccount,
  } = options;
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
    logger.info(i18n(`${i18nKey}.logs.updateConfig`));
    process.exit(EXIT_CODES.ERROR);
  }

  trackAuthAction('init', authType, TRACKING_STATUS.STARTED);
  createEmptyConfigFile({ path: configPath });
  handleExit(deleteEmptyConfigFile);

  try {
    const { accountId, name } = await CONFIG_CREATION_FLOWS[authType](
      env,
      optionalAccount
    );
    const configPath = getConfigPath();

    try {
      checkAndAddConfigToGitignore(configPath);
    } catch (e) {
      debugErrorAndContext(e);
    }

    logger.log('');
    logger.success(
      i18n(`${i18nKey}.success.configFileCreated`, {
        configPath,
      })
    );
    logger.success(
      i18n(`${i18nKey}.success.configFileUpdated`, {
        authType: AUTH_TYPE_NAMES[authType],
        account: name || accountId,
      })
    );
    uiFeatureHighlight(['helpCommand', 'authCommand', 'accountsListCommand']);

    await trackAuthAction(
      'init',
      authType,
      TRACKING_STATUS.COMPLETE,
      accountId
    );
    process.exit(EXIT_CODES.SUCCESS);
  } catch (err) {
    logErrorInstance(err);
    await trackAuthAction('init', authType, TRACKING_STATUS.ERROR);
    process.exit(EXIT_CODES.ERROR);
  }
};

exports.builder = yargs => {
  yargs.options({
    auth: {
      describe: i18n(`${i18nKey}.options.auth.describe`),
      type: 'string',
      choices: [
        `${PERSONAL_ACCESS_KEY_AUTH_METHOD.value}`,
        `${OAUTH_AUTH_METHOD.value}`,
      ],
      default: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
      defaultDescription: i18n(`${i18nKey}.options.auth.defaultDescription`, {
        defaultType: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
      }),
    },
    account: {
      describe: i18n(`${i18nKey}.options.account.describe`),
      type: 'string',
    },
  });

  addConfigOptions(yargs, true);
  addTestingOptions(yargs, true);

  return yargs;
};

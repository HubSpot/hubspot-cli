// @ts-nocheck
const { checkAndWarnGitInclusion } = require('../lib/ui/git');
const { logger } = require('@hubspot/local-dev-lib/logger');
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
const {
  getAccessToken,
  updateConfigWithAccessToken,
} = require('@hubspot/local-dev-lib/personalAccessKey');
const {
  updateAccountConfig,
  writeConfig,
  getConfigPath,
  loadConfig,
  getConfigDefaultAccount,
  getAccountId,
} = require('@hubspot/local-dev-lib/config');
const {
  commaSeparatedValues,
  toKebabCase,
} = require('@hubspot/local-dev-lib/text');
const { promptUser } = require('../lib/prompts/promptUtils');
const {
  personalAccessKeyPrompt,
  OAUTH_FLOW,
} = require('../lib/prompts/personalAccessKeyPrompt');
const { cliAccountNamePrompt } = require('../lib/prompts/accountNamePrompt');
const {
  setAsDefaultAccountPrompt,
} = require('../lib/prompts/setAsDefaultAccountPrompt');
const {
  addConfigOptions,
  setLogLevel,
  addTestingOptions,
  addGlobalOptions,
} = require('../lib/commonOpts');
const { trackAuthAction, trackCommandUsage } = require('../lib/usageTracking');
const { authenticateWithOauth } = require('../lib/oauth');
const { EXIT_CODES } = require('../lib/enums/exitCodes');
const { uiFeatureHighlight } = require('../lib/ui');
const { logError } = require('../lib/errorHandlers/index');

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

exports.command = 'auth';
exports.describe = i18n(`${i18nKey}.describe`, {
  configName: DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
});

exports.handler = async options => {
  const {
    authType: authTypeFlagValue,
    config: configFlagValue,
    qa,
    providedAccountId,
  } = options;
  const authType =
    (authTypeFlagValue && authTypeFlagValue.toLowerCase()) ||
    PERSONAL_ACCESS_KEY_AUTH_METHOD.value;
  setLogLevel(options);

  const env = qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD;
  // Needed to load deprecated config
  loadConfig(configFlagValue);
  checkAndWarnGitInclusion(getConfigPath());

  if (!getConfigPath(configFlagValue)) {
    logger.error(i18n(`${i18nKey}.errors.noConfigFileFound`));
    process.exit(EXIT_CODES.ERROR);
  }

  trackCommandUsage('auth');
  trackAuthAction('auth', authType, TRACKING_STATUS.STARTED);

  let configData;
  let updatedConfig;
  let validName;
  let successAuthMethod;
  let token;
  let defaultName;

  switch (authType) {
    case OAUTH_AUTH_METHOD.value:
      configData = await promptUser(OAUTH_FLOW);
      await authenticateWithOauth({
        ...configData,
        env,
      });
      successAuthMethod = OAUTH_AUTH_METHOD.name;
      break;
    case PERSONAL_ACCESS_KEY_AUTH_METHOD.value:
      configData = await personalAccessKeyPrompt({
        env,
        account: providedAccountId,
      });

      try {
        token = await getAccessToken(configData.personalAccessKey, env);
        defaultName = toKebabCase(token.hubName);

        updatedConfig = await updateConfigWithAccessToken(
          token,
          configData.personalAccessKey,
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
        environment: updatedConfig.env,
        tokenInfo: updatedConfig.auth.tokenInfo,
        name: validName,
      });
      writeConfig();

      successAuthMethod = PERSONAL_ACCESS_KEY_AUTH_METHOD.name;
      break;
    default:
      logger.error(
        i18n(`${i18nKey}.errors.unsupportedAuthType`, {
          supportedProtocols: SUPPORTED_AUTHENTICATION_PROTOCOLS_TEXT,
          type,
        })
      );
      break;
  }

  if (!successAuthMethod) {
    await trackAuthAction('auth', authType, TRACKING_STATUS.ERROR);
    process.exit(EXIT_CODES.ERROR);
  }

  const accountName =
    (updatedConfig && updatedConfig.name) || validName || configData.name;

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
        accountName: getConfigDefaultAccount(),
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

  const accountId = getAccountId(accountName);
  await trackAuthAction('auth', authType, TRACKING_STATUS.COMPLETE, accountId);

  process.exit(EXIT_CODES.SUCCESS);
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
          authMethod: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
        }
      ),
    },
    account: {
      describe: i18n(`${i18nKey}.options.account.describe`),
      type: 'string',
      alias: 'a',
    },
  });

  addConfigOptions(yargs);
  addTestingOptions(yargs);
  addGlobalOptions(yargs);

  return yargs;
};

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
  getConfig,
  getConfigPath,
  loadConfig,
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
  getAccountId,
  addTestingOptions,
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
const SUPPORTED_AUTHENTICATION_PROTOCOLS_TEXT = commaSeparatedValues(
  ALLOWED_AUTH_METHODS
);

exports.command = 'auth [type] [--account]';
exports.describe = i18n(`${i18nKey}.describe`, {
  supportedProtocols: SUPPORTED_AUTHENTICATION_PROTOCOLS_TEXT,
});

exports.handler = async options => {
  const { type, config: c, qa, account } = options;
  const authType =
    (type && type.toLowerCase()) || PERSONAL_ACCESS_KEY_AUTH_METHOD.value;
  setLogLevel(options);

  if (!getConfigPath(c)) {
    logger.error(i18n(`${i18nKey}.errors.noConfigFileFound`));
    process.exit(EXIT_CODES.ERROR);
  }

  const env = qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD;
  loadConfig(c);
  checkAndWarnGitInclusion(getConfigPath());

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
      configData = await personalAccessKeyPrompt({ env, account });

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
    const config = getConfig();
    logger.info(
      i18n(`lib.prompts.setAsDefaultAccountPrompt.keepingCurrentDefault`, {
        accountName: config.defaultPortal,
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

  const accountId = getAccountId({ account: accountName });
  await trackAuthAction('auth', authType, TRACKING_STATUS.COMPLETE, accountId);

  process.exit(EXIT_CODES.SUCCESS);
};

exports.builder = yargs => {
  yargs.positional('type', {
    describe: i18n(`${i18nKey}.positionals.type.describe`),
    type: 'string',
    choices: [
      `${PERSONAL_ACCESS_KEY_AUTH_METHOD.value}`,
      `${OAUTH_AUTH_METHOD.value}`,
    ],
    default: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
    defaultDescription: i18n(`${i18nKey}.positionals.type.defaultDescription`, {
      authMethod: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
    }),
  });

  yargs.options({
    account: {
      describe: i18n(`${i18nKey}.options.account.describe`),
      type: 'string',
    },
  });

  addConfigOptions(yargs);
  addTestingOptions(yargs);

  return yargs;
};

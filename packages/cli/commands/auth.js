const { loadConfig, checkAndWarnGitInclusion } = require('@hubspot/cli-lib');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  OAUTH_AUTH_METHOD,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
  API_KEY_AUTH_METHOD,
  ENVIRONMENTS,
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
} = require('@hubspot/cli-lib/lib/constants');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const {
  updateConfigWithPersonalAccessKey,
} = require('@hubspot/cli-lib/personalAccessKey');
const {
  updateAccountConfig,
  accountNameExistsInConfig,
  writeConfig,
  getConfigPath,
} = require('@hubspot/cli-lib/lib/config');
const { commaSeparatedValues } = require('@hubspot/cli-lib/lib/text');
const { promptUser } = require('../lib/prompts/promptUtils');
const {
  personalAccessKeyPrompt,
  OAUTH_FLOW,
  API_KEY_FLOW,
  ACCOUNT_NAME,
} = require('../lib/prompts/personalAccessKeyPrompt');
const {
  addConfigOptions,
  setLogLevel,
  addTestingOptions,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const { trackCommandUsage } = require('../lib/usageTracking');
const { authenticateWithOauth } = require('../lib/oauth');
const { EXIT_CODES } = require('../lib/enums/exitCodes');

const i18nKey = 'cli.commands.auth';

const ALLOWED_AUTH_METHODS = [
  OAUTH_AUTH_METHOD.value,
  PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
];
const SUPPORTED_AUTHENTICATION_PROTOCOLS_TEXT = commaSeparatedValues(
  ALLOWED_AUTH_METHODS
);

const promptForAccountNameIfNotSet = async updatedConfig => {
  if (!updatedConfig.name) {
    let promptAnswer;
    let validName = null;
    while (!validName) {
      promptAnswer = await promptUser([ACCOUNT_NAME]);

      if (!accountNameExistsInConfig(promptAnswer.name)) {
        validName = promptAnswer.name;
      } else {
        logger.log(
          i18n(`${i18nKey}.errors.accountNameExists`, {
            name: promptAnswer.name,
          })
        );
      }
    }
    return validName;
  }
};

exports.command = 'auth [type]';
exports.describe = i18n(`${i18nKey}.describe`, {
  supportedProtocols: SUPPORTED_AUTHENTICATION_PROTOCOLS_TEXT,
});

exports.handler = async options => {
  const { type, config: configPath, qa } = options;
  const authType =
    (type && type.toLowerCase()) || PERSONAL_ACCESS_KEY_AUTH_METHOD.value;
  setLogLevel(options);
  logDebugInfo(options);

  if (!getConfigPath()) {
    logger.error(i18n(`${i18nKey}.errors.noConfigFileFound`));
    process.exit(EXIT_CODES.ERROR);
  }

  const env = qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD;
  loadConfig(configPath);
  checkAndWarnGitInclusion(getConfigPath());

  trackCommandUsage('auth');

  let configData;
  let updatedConfig;
  let validName;
  switch (authType) {
    case API_KEY_AUTH_METHOD.value:
      configData = await promptUser(API_KEY_FLOW);
      updatedConfig = await updateAccountConfig(configData);
      validName = await promptForAccountNameIfNotSet(updatedConfig);

      updateAccountConfig({
        ...updatedConfig,
        environment: updatedConfig.env,
        name: validName,
      });
      writeConfig();

      logger.success(
        i18n(`${i18nKey}.success.configFileUpdated`, {
          configFilename: DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
          authMethod: API_KEY_AUTH_METHOD.name,
        })
      );

      break;
    case OAUTH_AUTH_METHOD.value:
      configData = await promptUser(OAUTH_FLOW);
      await authenticateWithOauth({
        ...configData,
        env,
      });
      break;
    case PERSONAL_ACCESS_KEY_AUTH_METHOD.value:
      configData = await personalAccessKeyPrompt({ env });
      updatedConfig = await updateConfigWithPersonalAccessKey(configData);

      if (!updatedConfig) {
        process.exit(EXIT_CODES.SUCCESS);
      }

      validName = await promptForAccountNameIfNotSet(updatedConfig);

      updateAccountConfig({
        ...updatedConfig,
        environment: updatedConfig.env,
        tokenInfo: updatedConfig.auth.tokenInfo,
        name: validName,
      });
      writeConfig();

      logger.success(
        i18n(`${i18nKey}.success.configFileUpdated`, {
          configFilename: DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
          authMethod: PERSONAL_ACCESS_KEY_AUTH_METHOD.name,
        })
      );
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
  process.exit(EXIT_CODES.SUCCESS);
};

exports.builder = yargs => {
  yargs.positional('type', {
    describe: i18n(`${i18nKey}.positionals.type.describe`),
    type: 'string',
    choices: [
      `${PERSONAL_ACCESS_KEY_AUTH_METHOD.value}`,
      `${OAUTH_AUTH_METHOD.value}`,
      `${API_KEY_AUTH_METHOD.value}`,
    ],
    default: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
    defaultDescription: i18n(`${i18nKey}.positionals.type.defaultDescription`, {
      authMethod: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
    }),
  });

  addConfigOptions(yargs, true);
  addTestingOptions(yargs, true);

  return yargs;
};

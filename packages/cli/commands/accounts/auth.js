const {
  updateDefaultAccount,
  CLIConfig,
} = require('@hubspot/cli-lib/lib/config');
const { configFileExists } = require('@hubspot/cli-lib/config/configFile');
const { addConfigOptions } = require('../../lib/commonOpts');
const { handleExit } = require('@hubspot/cli-lib/lib/process');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');
const {
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
  OAUTH_AUTH_METHOD,
  ENVIRONMENTS,
} = require('@hubspot/cli-lib/lib/constants');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  generatePersonalAccessKeyConfig,
} = require('@hubspot/cli-lib/personalAccessKey');
const {
  trackCommandUsage,
  trackAuthAction,
} = require('../../lib/usageTracking');
const { setLogLevel, addTestingOptions } = require('../../lib/commonOpts');
const { promptUser } = require('../../lib/prompts/promptUtils');
const {
  setAsDefaultAccountPrompt,
} = require('../../lib/prompts/setAsDefaultAccountPrompt');
const {
  OAUTH_FLOW,
  personalAccessKeyPrompt,
} = require('../../lib/prompts/personalAccessKeyPrompt');
const {
  enterAccountNamePrompt,
} = require('../../lib/prompts/enterAccountNamePrompt');
const { logDebugInfo } = require('../../lib/debugInfo');
const { authenticateWithOauth } = require('../../lib/oauth');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { uiFeatureHighlight } = require('../../lib/ui');

const i18nKey = 'cli.commands.init';

const TRACKING_STATUS = {
  STARTED: 'started',
  ERROR: 'error',
  COMPLETE: 'complete',
};

const personalAccessKeyConfigCreationFlow = async (env, account) => {
  const configData = await personalAccessKeyPrompt({ env, account });
  return generatePersonalAccessKeyConfig(configData);
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

exports.command = 'auth [--account]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const {
    auth: authType = PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
    account: optionalAccount,
  } = options;
  setLogLevel(options);
  logDebugInfo(options);
  trackCommandUsage('accounts-auth', {
    authType,
  });
  const env = options.qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD;

  CLIConfig.init(options);

  // Create the config file if one does not exist
  if (!configFileExists()) {
    CLIConfig.write({ accounts: [] });
    handleExit(() => {
      CLIConfig.delete();
    });
  }

  try {
    const newAccountData = await CONFIG_CREATION_FLOWS[authType](
      env,
      optionalAccount
    );

    let newAccountConfig = CLIConfig.updateConfigForAccount(newAccountData);
    const { accountId, name } = newAccountConfig;

    // If this is a new account config, we need a name
    if (!name) {
      const { name: nameFromPrompt } = await enterAccountNamePrompt();
      newAccountConfig = CLIConfig.updateConfigForAccount({
        accountId,
        name: nameFromPrompt,
      });
    }

    if (!CLIConfig.getDefaultAccount()) {
      CLIConfig.updateDefaultAccount(newAccountConfig.name);
    } else {
      await setAsDefaultAccountPrompt(newAccountConfig.name);
    }

    logger.log('');
    logger.success(i18n(`${i18nKey}.success.configFileCreated`));
    logger.success(
      i18n(`${i18nKey}.success.configFileUpdated`, {
        authType: AUTH_TYPE_NAMES[authType],
        account: newAccountConfig.name,
      })
    );
    uiFeatureHighlight(['helpCommand', 'authCommand', 'accountsListCommand']);

    trackAuthAction(
      'accounts-auth',
      authType,
      TRACKING_STATUS.COMPLETE,
      newAccountConfig.accountId
    );
    process.exit(EXIT_CODES.SUCCESS);
  } catch (err) {
    logErrorInstance(err);
    trackAuthAction('accounts-auth', authType, TRACKING_STATUS.ERROR);
    CLIConfig.delete();
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

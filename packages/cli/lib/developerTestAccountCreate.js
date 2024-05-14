const SpinniesManager = require('./ui/SpinniesManager');
const {
  getAccountId,
  accountNameExistsInConfig,
  updateAccountConfig,
  writeConfig,
} = require('@hubspot/local-dev-lib/config');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  createDeveloperTestAccount,
} = require('@hubspot/local-dev-lib/developerTestAccounts');
const { i18n } = require('./lang');
const {
  debugErrorAndContext,
  logErrorInstance,
} = require('./errorHandlers/standardErrors');
const {
  isMissingScopeError,
  isSpecifiedError,
} = require('@hubspot/local-dev-lib/errors/apiErrors');
const {
  getAccessToken,
  updateConfigWithAccessToken,
} = require('@hubspot/local-dev-lib/personalAccessKey');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const { uiAccountDescription } = require('./ui');
const {
  personalAccessKeyPrompt,
} = require('./prompts/personalAccessKeyPrompt');
const { enterAccountNamePrompt } = require('./prompts/enterAccountNamePrompt');

const i18nKey = 'lib.developerTestAccount';

const saveDevTestAccountToConfig = async (env, result, force = false) => {
  let personalAccessKey = result.personalAccessKey;
  if (!personalAccessKey) {
    const configData = await personalAccessKeyPrompt({
      env,
      account: result.id,
    });
    personalAccessKey = configData.personalAccessKey;
  }

  const token = await getAccessToken(personalAccessKey, env);
  const updatedConfig = await updateConfigWithAccessToken(
    token,
    personalAccessKey,
    env
  );

  let validName = updatedConfig.name;
  if (!updatedConfig.name) {
    const nameForConfig = result.accountName
      .toLowerCase()
      .split(' ')
      .join('-');
    validName = nameForConfig;
    const invalidAccountName = accountNameExistsInConfig(nameForConfig);
    if (invalidAccountName) {
      if (!force) {
        logger.log('');
        logger.warn(
          i18n(`lib.prompts.enterAccountNamePrompt.errors.accountNameExists`, {
            name: nameForConfig,
          })
        );
        const { name: promptName } = await enterAccountNamePrompt(
          nameForConfig + `_${result.id}`
        );
        validName = promptName;
      } else {
        // Basic invalid name handling when force flag is passed
        validName = nameForConfig + `_${result.id}`;
      }
    }
  }

  updateAccountConfig({
    ...updatedConfig,
    environment: updatedConfig.env,
    tokenInfo: updatedConfig.auth.tokenInfo,
    name: validName,
  });
  writeConfig();

  logger.log('');
  return validName;
};

const buildDeveloperTestAccount = async ({
  name,
  accountConfig,
  env,
  maxTestPortals,
  force = false,
}) => {
  SpinniesManager.init({
    succeedColor: 'white',
  });
  const accountId = getAccountId(accountConfig.portalId);

  let result;
  const spinniesI18nKey = `${i18nKey}.create.loading`;

  try {
    logger.log('');
    SpinniesManager.add('devTestAcctCreate', {
      text: i18n(`${spinniesI18nKey}.add`, {
        accountName: name,
      }),
    });
    result = await createDeveloperTestAccount(accountId, name);

    SpinniesManager.succeed('devTestAcctCreate', {
      text: i18n(`${spinniesI18nKey}.succeed`, {
        name: result.accountName,
        accountId: result.id,
      }),
    });
  } catch (err) {
    debugErrorAndContext(err);

    SpinniesManager.fail('devTestAcctCreate', {
      text: i18n(`${spinniesI18nKey}.fail`, {
        accountName: name,
      }),
    });

    if (isMissingScopeError(err)) {
      logger.error(
        i18n(`${i18nKey}.create.failure.scopes.message`, {
          accountName: uiAccountDescription(accountId),
        })
      );
      const websiteOrigin = getHubSpotWebsiteOrigin(env);
      const url = `${websiteOrigin}/personal-access-key/${accountId}`;
      logger.info(
        i18n(`${i18nKey}.create.failure.scopes.instructions`, {
          accountName: uiAccountDescription(accountId),
          url,
        })
      );
    } else if (
      isSpecifiedError(err, {
        statusCode: 400,
        errorType: 'TEST_PORTAL_LIMIT_REACHED',
      })
    ) {
      logger.log('');
      logger.error(
        i18n(`${i18nKey}.create.failure.limit`, {
          accountName: uiAccountDescription(accountId),
          limit: maxTestPortals,
        })
      );
      logger.log('');
    } else {
      logErrorInstance(err);
    }
    throw err;
  }

  let devTestAcctConfigName;

  try {
    // Response contains PAK, save to config here
    devTestAcctConfigName = await saveDevTestAccountToConfig(
      env,
      result,
      force
    );
  } catch (err) {
    logErrorInstance(err);
    throw err;
  }

  return {
    devTestAcctConfigName,
    result,
  };
};

module.exports = {
  buildDeveloperTestAccount,
  saveDevTestAccountToConfig,
};

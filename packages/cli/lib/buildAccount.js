const {
  getAccessToken,
  updateConfigWithAccessToken,
} = require('@hubspot/local-dev-lib/personalAccessKey');
const {
  personalAccessKeyPrompt,
} = require('./prompts/personalAccessKeyPrompt');
const {
  accountNameExistsInConfig,
  updateAccountConfig,
  writeConfig,
  getAccountId,
} = require('@hubspot/local-dev-lib/config');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { i18n } = require('./lang');
const { cliAccountNamePrompt } = require('./prompts/accountNamePrompt');
const SpinniesManager = require('./ui/SpinniesManager');
const { debugError, logError } = require('./errorHandlers/index');
const {
  createDeveloperTestAccount,
} = require('@hubspot/local-dev-lib/api/developerTestAccounts');
const {
  HUBSPOT_ACCOUNT_TYPES,
} = require('@hubspot/local-dev-lib/constants/config');
const { createSandbox } = require('@hubspot/local-dev-lib/api/sandboxHubs');
const { sandboxApiTypeMap, handleSandboxCreateError } = require('./sandboxes');
const {
  handleDeveloperTestAccountCreateError,
} = require('./developerTestAccounts');

async function saveAccountToConfig({
  env,
  personalAccessKey,
  accountName,
  accountId,
  force = false,
}) {
  if (!personalAccessKey) {
    const configData = await personalAccessKeyPrompt({
      env,
      account: accountId,
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
    const nameForConfig = accountName
      .toLowerCase()
      .split(' ')
      .join('-');
    validName = nameForConfig;
    const invalidAccountName = accountNameExistsInConfig(nameForConfig);
    if (invalidAccountName) {
      if (!force) {
        logger.log('');
        logger.warn(
          i18n(`lib.prompts.accountNamePrompt.errors.accountNameExists`, {
            name: nameForConfig,
          })
        );
        const { name: promptName } = await cliAccountNamePrompt(
          nameForConfig + `_${accountId}`
        );
        validName = promptName;
      } else {
        // Basic invalid name handling when force flag is passed
        validName = nameForConfig + `_${accountId}`;
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
}

async function buildNewAccount({
  name,
  accountType,
  accountConfig,
  env,
  portalLimit, // Used only for developer test accounts
  force = false,
}) {
  SpinniesManager.init({
    succeedColor: 'white',
  });
  const accountId = getAccountId(accountConfig.portalId);
  const isSandbox =
    accountType === HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX ||
    accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX;
  const isDeveloperTestAccount =
    accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST;

  let result;
  let spinniesI18nKey;
  if (isSandbox) {
    if (accountType === HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX) {
      spinniesI18nKey = 'lib.sandbox.create.loading.standard';
    }
    if (accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX) {
      spinniesI18nKey = 'lib.sandbox.create.loading.developer';
    }
  } else if (isDeveloperTestAccount) {
    spinniesI18nKey = 'lib.developerTestAccount.create.loading';
  }

  logger.log('');
  SpinniesManager.add('buildNewAccount', {
    text: i18n(`${spinniesI18nKey}.add`, {
      accountName: name,
    }),
  });

  let resultAccountId;
  try {
    if (isSandbox) {
      const sandboxApiType = sandboxApiTypeMap[accountType]; // API expects sandbox type as 1 or 2.

      const { data } = await createSandbox(accountId, name, sandboxApiType);
      result = { name, ...data };
      resultAccountId = result.sandbox.sandboxHubId;
    } else if (isDeveloperTestAccount) {
      const { data } = await createDeveloperTestAccount(accountId, name);
      result = data;
      resultAccountId = result.id;
    }

    SpinniesManager.succeed('buildNewAccount', {
      text: i18n(`${spinniesI18nKey}.succeed`, {
        accountName: name,
        accountId: resultAccountId,
      }),
    });
  } catch (err) {
    debugError(err);

    SpinniesManager.fail('buildNewAccount', {
      text: i18n(`${spinniesI18nKey}.fail`, {
        accountName: name,
      }),
    });

    if (isSandbox) {
      handleSandboxCreateError({ err, env, accountConfig, name, accountId });
    }
    if (isDeveloperTestAccount) {
      handleDeveloperTestAccountCreateError({
        err,
        env,
        accountId,
        portalLimit,
      });
    }
  }

  let configAccountName;

  try {
    // Response contains PAK, save to config here
    configAccountName = await saveAccountToConfig({
      env,
      personalAccessKey: result.personalAccessKey,
      accountName: name,
      accountId: resultAccountId,
      force,
    });
  } catch (err) {
    logError(err);
    throw err;
  }

  return {
    configAccountName,
    result,
  };
}

module.exports = {
  buildNewAccount,
  saveAccountToConfig,
};

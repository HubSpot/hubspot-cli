const SpinniesManager = require('./ui/SpinniesManager');
const {
  getSandboxLimit,
  getHasSandboxesByType,
  sandboxApiTypeMap,
} = require('./sandboxes');
const { i18n } = require('./lang');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  debugErrorAndContext,
  logErrorInstance,
} = require('./errorHandlers/standardErrors');
const {
  isMissingScopeError,
  isSpecifiedError,
} = require('@hubspot/local-dev-lib/errors/apiErrors');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const { getEnv, getAccountId } = require('@hubspot/local-dev-lib/config');
const { createSandbox } = require('@hubspot/local-dev-lib/sandboxes');
const { getValidEnv } = require('@hubspot/local-dev-lib/environment');
const {
  getAccessToken,
  updateConfigWithAccessToken,
} = require('@hubspot/local-dev-lib/personalAccessKey');
const { uiAccountDescription } = require('./ui');
const {
  personalAccessKeyPrompt,
} = require('./prompts/personalAccessKeyPrompt');
const { enterAccountNamePrompt } = require('./prompts/enterAccountNamePrompt');
const {
  accountNameExistsInConfig,
  writeConfig,
  updateAccountConfig,
} = require('@hubspot/local-dev-lib/config');
const {
  HUBSPOT_ACCOUNT_TYPES,
} = require('@hubspot/local-dev-lib/constants/config');

const i18nKey = 'lib.sandbox.create';

/**
 * @param {String} env - Environment (QA/Prod)
 * @param {Object} result - Sandbox instance returned from API
 * @param {Boolean} force - Force flag to skip prompt
 * @returns {String} validName saved into config
 */
const saveSandboxToConfig = async (env, result, force = false) => {
  let personalAccessKey = result.personalAccessKey;
  if (!personalAccessKey) {
    const configData = await personalAccessKeyPrompt({
      env,
      account: result.sandbox.sandboxHubId,
    });
    personalAccessKey = configData.personalAccessKey;
  }

  let updatedConfig;

  try {
    const token = await getAccessToken(personalAccessKey, env);
    updatedConfig = await updateConfigWithAccessToken(
      token,
      personalAccessKey,
      env
    );
  } catch (e) {
    logErrorInstance(e);
  }

  if (!updatedConfig) {
    throw new Error('Failed to update config with personal access key.');
  }

  let validName = updatedConfig.name;
  if (!updatedConfig.name) {
    const nameForConfig = result.sandbox.name
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
          nameForConfig + `_${result.sandbox.sandboxHubId}`
        );
        validName = promptName;
      } else {
        // Basic invalid name handling when force flag is passed
        validName = nameForConfig + `_${result.sandbox.sandboxHubId}`;
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

/**
 * @param {String} name - Name of sandbox
 * @param {String} type - Sandbox type to be created (STANDARD_SANDBOX/DEVELOPMENT_SANDBOX)
 * @param {Object} accountConfig - Account config of parent portal
 * @param {String} env - Environment (QA/Prod)
 * @returns {Object} Object containing sandboxConfigName string and sandbox instance from API
 */
const buildSandbox = async ({
  name,
  type,
  accountConfig,
  env,
  force = false,
}) => {
  SpinniesManager.init({
    succeedColor: 'white',
  });
  const accountId = getAccountId(accountConfig.portalId);

  let result;
  const loadingLangKey =
    type === HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX
      ? 'developer'
      : 'standard';
  const spinniesI18nKey = `${i18nKey}.loading.${loadingLangKey}`;

  try {
    logger.log('');
    SpinniesManager.add('sandboxCreate', {
      text: i18n(`${spinniesI18nKey}.add`, {
        sandboxName: name,
      }),
    });
    const sandboxApiType = sandboxApiTypeMap[type]; // API expects sandbox type as 1 or 2
    result = await createSandbox(accountId, name, sandboxApiType);

    SpinniesManager.succeed('sandboxCreate', {
      text: i18n(`${spinniesI18nKey}.succeed`, {
        name: result.sandbox.name,
        sandboxHubId: result.sandbox.sandboxHubId,
      }),
    });
  } catch (err) {
    debugErrorAndContext(err);

    SpinniesManager.fail('sandboxCreate', {
      text: i18n(`${spinniesI18nKey}.fail`, {
        sandboxName: name,
      }),
    });

    if (isMissingScopeError(err)) {
      logger.error(
        i18n(`${i18nKey}.failure.scopes.message`, {
          accountName: uiAccountDescription(accountId),
        })
      );
      const websiteOrigin = getHubSpotWebsiteOrigin(env);
      const url = `${websiteOrigin}/personal-access-key/${accountId}`;
      logger.info(
        i18n(`${i18nKey}.failure.scopes.instructions`, {
          accountName: uiAccountDescription(accountId),
          url,
        })
      );
    } else if (
      isSpecifiedError(err, {
        statusCode: 403,
        category: 'BANNED',
        subCategory: 'SandboxErrors.USER_ACCESS_NOT_ALLOWED',
      })
    ) {
      logger.log('');
      logger.error(
        i18n(`${i18nKey}.failure.invalidUser`, {
          accountName: name,
          parentAccountName: uiAccountDescription(accountId),
        })
      );
      logger.log('');
    } else if (
      isSpecifiedError(err, {
        statusCode: 403,
        category: 'BANNED',
        subCategory: 'SandboxErrors.DEVELOPMENT_SANDBOX_ACCESS_NOT_ALLOWED',
      })
    ) {
      logger.log('');
      logger.error(
        i18n(`${i18nKey}.failure.403Gating`, {
          accountName: name,
          parentAccountName: uiAccountDescription(accountId),
          accountId,
        })
      );
      logger.log('');
    } else if (
      isSpecifiedError(err, {
        statusCode: 400,
        category: 'VALIDATION_ERROR',
        subCategory:
          'SandboxErrors.NUM_DEVELOPMENT_SANDBOXES_LIMIT_EXCEEDED_ERROR',
      }) &&
      err.error &&
      err.error.message
    ) {
      logger.log('');
      const devSandboxLimit = getSandboxLimit(err.error);
      const plural = devSandboxLimit !== 1;
      const hasDevelopmentSandboxes = getHasSandboxesByType(
        accountConfig,
        HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX
      );
      if (hasDevelopmentSandboxes) {
        logger.error(
          i18n(
            `${i18nKey}.failure.alreadyInConfig.developer.${
              plural ? 'other' : 'one'
            }`,
            {
              accountName: uiAccountDescription(accountId),
              limit: devSandboxLimit,
            }
          )
        );
      } else {
        const baseUrl = getHubSpotWebsiteOrigin(getValidEnv(getEnv(accountId)));
        logger.error(
          i18n(
            `${i18nKey}.failure.limit.developer.${plural ? 'other' : 'one'}`,
            {
              accountName: uiAccountDescription(accountId),
              limit: devSandboxLimit,
              link: `${baseUrl}/sandboxes-developer/${accountId}/development`,
            }
          )
        );
      }
      logger.log('');
    } else if (
      isSpecifiedError(err, {
        statusCode: 400,
        category: 'VALIDATION_ERROR',
        subCategory:
          'SandboxErrors.NUM_STANDARD_SANDBOXES_LIMIT_EXCEEDED_ERROR',
      }) &&
      err.error &&
      err.error.message
    ) {
      logger.log('');
      const standardSandboxLimit = getSandboxLimit(err.error);
      const plural = standardSandboxLimit !== 1;
      const hasStandardSandboxes = getHasSandboxesByType(
        accountConfig,
        HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX
      );
      if (hasStandardSandboxes) {
        logger.error(
          i18n(
            `${i18nKey}.failure.alreadyInConfig.standard.${
              plural ? 'other' : 'one'
            }`,
            {
              accountName: uiAccountDescription(accountId),
              limit: standardSandboxLimit,
            }
          )
        );
      } else {
        const baseUrl = getHubSpotWebsiteOrigin(getValidEnv(getEnv(accountId)));
        logger.error(
          i18n(
            `${i18nKey}.failure.limit.standard.${plural ? 'other' : 'one'}`,
            {
              accountName: uiAccountDescription(accountId),
              limit: standardSandboxLimit,
              link: `${baseUrl}/sandboxes-developer/${accountId}/standard`,
            }
          )
        );
      }
      logger.log('');
    } else {
      logErrorInstance(err);
    }
    throw err;
  }

  let sandboxConfigName;

  try {
    // Response contains PAK, save to config here
    sandboxConfigName = await saveSandboxToConfig(env, result, force);
  } catch (err) {
    logErrorInstance(err);
    throw err;
  }

  return {
    sandboxConfigName,
    result,
  };
};

module.exports = {
  buildSandbox,
};

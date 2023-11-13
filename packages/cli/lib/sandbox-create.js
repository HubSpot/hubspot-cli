const SpinniesManager = require('./SpinniesManager');
const {
  getSandboxLimit,
  getHasSandboxesByType,
  saveSandboxToConfig,
  sandboxApiTypeMap,
  STANDARD_SANDBOX,
  DEVELOPER_SANDBOX,
} = require('./sandboxes');
const { i18n } = require('./lang');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  debugErrorAndContext,
  logErrorInstance,
} = require('./errorHandlers/standardErrors');
const {
  isMissingScopeError,
  isSpecifiedError,
} = require('./errorHandlers/apiErrors');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const { getEnv, getAccountId } = require('@hubspot/local-dev-lib/config');
const { createSandbox } = require('@hubspot/local-dev-lib/sandboxes');
const { getValidEnv } = require('@hubspot/local-dev-lib/environment');

const i18nKey = 'cli.lib.sandbox.create';

/**
 * @param {String} name - Name of sandbox
 * @param {String} type - Sandbox type to be created (standard/developer)
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
  const spinniesI18nKey = `${i18nKey}.loading.${type}`;

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
          accountName: accountConfig.name || accountId,
        })
      );
      const websiteOrigin = getHubSpotWebsiteOrigin(env);
      const url = `${websiteOrigin}/personal-access-key/${accountId}`;
      logger.info(
        i18n(`${i18nKey}.failure.scopes.instructions`, {
          accountName: accountConfig.name || accountId,
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
          parentAccountName: accountConfig.name || accountId,
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
        DEVELOPER_SANDBOX
      );
      if (hasDevelopmentSandboxes) {
        logger.error(
          i18n(
            `${i18nKey}.failure.alreadyInConfig.developer.${
              plural ? 'other' : 'one'
            }`,
            {
              accountName: accountConfig.name || accountId,
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
              accountName: accountConfig.name || accountId,
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
        STANDARD_SANDBOX
      );
      if (hasStandardSandboxes) {
        logger.error(
          i18n(
            `${i18nKey}.failure.alreadyInConfig.standard.${
              plural ? 'other' : 'one'
            }`,
            {
              accountName: accountConfig.name || accountId,
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
              accountName: accountConfig.name || accountId,
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

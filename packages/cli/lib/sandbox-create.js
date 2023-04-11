const Spinnies = require('spinnies');
const {
  sandboxNamePrompt,
  sandboxTypePrompt,
} = require('./prompts/sandboxesPrompt');
const {
  sandboxTypeMap,
  getDevSandboxLimit,
  getHasDevelopmentSandboxes,
  saveSandboxToConfig,
  sandboxApiTypeMap,
  getSandboxTypeAsString,
} = require('./sandboxes');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  debugErrorAndContext,
  logErrorInstance,
} = require('@hubspot/cli-lib/errorHandlers/standardErrors');
const { trackCommandUsage } = require('./usageTracking');
const {
  isMissingScopeError,
  isSpecifiedError,
} = require('@hubspot/cli-lib/errorHandlers/apiErrors');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cli-lib/lib/urls');
const { ENVIRONMENTS } = require('@hubspot/cli-lib/lib/constants');
const { getEnv } = require('@hubspot/cli-lib');
const { createSandbox } = require('@hubspot/cli-lib/sandboxes');

const i18nKey = 'cli.commands.sandbox.subcommands.create';

/**
 * @param {String} name - Name of sandbox
 * @param {String} type - Standard or development sandbox type
 * @param {Object} accountConfig - Account config of parent portal
 * @param {String} env - Environment (QA/Prod)
 * @returns {Object} sandboxConfigName string and sandbox instance from API
 */
const buildSandbox = async ({ name, type, accountConfig, env }) => {
  const spinnies = new Spinnies({
    succeedColor: 'white',
  });
  const accountId = accountConfig.portalId;

  trackCommandUsage('sandbox-create', null, accountId);

  // Default account is not a production portal
  if (
    accountConfig.sandboxAccountType &&
    accountConfig.sandboxAccountType !== null
  ) {
    trackCommandUsage('sandbox-create', { successful: false }, accountId);
    logger.error(
      i18n(`${i18nKey}.failure.creatingWithinSandbox`, {
        sandboxType: getSandboxTypeAsString(accountConfig.sandboxAccountType),
      })
    );
    throw new Error(
      i18n(`${i18nKey}.failure.creatingWithinSandbox`, {
        sandboxType: getSandboxTypeAsString(accountConfig.sandboxAccountType),
      })
    );
  }

  let namePrompt;
  let typePrompt;

  if (!name) {
    namePrompt = await sandboxNamePrompt();
  }
  if ((type && !sandboxTypeMap[type]) || !type) {
    typePrompt = await sandboxTypePrompt();
  }

  const sandboxName = name || namePrompt.name;
  const sandboxType = sandboxTypeMap[type] || sandboxTypeMap[typePrompt.type];

  let result;

  try {
    spinnies.add('sandboxCreate', {
      text: i18n(`${i18nKey}.loading.add`, {
        sandboxName,
      }),
    });

    const sandboxApiType = sandboxApiTypeMap[sandboxType]; // API expects sandbox type as 1 or 2
    result = await createSandbox(accountId, sandboxName, sandboxApiType);

    logger.log('');
    spinnies.succeed('sandboxCreate', {
      text: i18n(`${i18nKey}.loading.succeed`, {
        name: result.name,
        sandboxHubId: result.sandboxHubId,
      }),
    });
  } catch (err) {
    debugErrorAndContext(err);

    trackCommandUsage('sandbox-create', { successful: false }, accountId);

    spinnies.fail('sandboxCreate', {
      text: i18n(`${i18nKey}.loading.fail`, {
        sandboxName,
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
      isSpecifiedError(
        err,
        400,
        'VALIDATION_ERROR',
        'SandboxErrors.NUM_DEVELOPMENT_SANDBOXES_LIMIT_EXCEEDED_ERROR'
      ) &&
      err.error &&
      err.error.message
    ) {
      logger.log('');
      const devSandboxLimit = getDevSandboxLimit(err.error);
      const plural = devSandboxLimit !== 1;
      const hasDevelopmentSandboxes = getHasDevelopmentSandboxes(accountConfig);
      if (hasDevelopmentSandboxes) {
        logger.error(
          i18n(
            `${i18nKey}.failure.alreadyInConfig.${plural ? 'other' : 'one'}`,
            {
              accountName: accountConfig.name || accountId,
              limit: devSandboxLimit,
            }
          )
        );
      } else {
        const baseUrl = getHubSpotWebsiteOrigin(
          getEnv(accountId) === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
        );
        logger.error(
          i18n(`${i18nKey}.failure.limit.${plural ? 'other' : 'one'}`, {
            accountName: accountConfig.name || accountId,
            limit: devSandboxLimit,
            devSandboxesLink: `${baseUrl}/sandboxes-developer/${accountId}/development`,
          })
        );
      }
      logger.log('');
    } else {
      logErrorInstance(err);
    }
    throw err;
  }

  // If creating standard sandbox, prompt user to sync assets

  let sandboxConfigName;

  try {
    // Response contains PAK, save to config here
    sandboxConfigName = await saveSandboxToConfig(env, result);
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

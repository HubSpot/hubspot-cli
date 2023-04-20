const Spinnies = require('spinnies');
const {
  sandboxNamePrompt,
  sandboxTypePrompt,
} = require('./prompts/sandboxesPrompt');
const {
  sandboxTypeMap,
  getSandboxLimit,
  getHasSandboxesByType,
  saveSandboxToConfig,
  sandboxApiTypeMap,
  getSandboxTypeAsString,
  getAccountName,
  STANDARD_SANDBOX,
  DEVELOPER_SANDBOX,
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
const {
  getEnv,
  getAccountConfig,
  getConfig,
  getAccountId,
} = require('@hubspot/cli-lib');
const { createSandbox } = require('@hubspot/cli-lib/sandboxes');
const { promptUser } = require('./prompts/promptUtils');
const { syncSandbox } = require('./sandbox-sync');
const {
  setAsDefaultAccountPrompt,
} = require('./prompts/setAsDefaultAccountPrompt');
const { updateDefaultAccount } = require('@hubspot/cli-lib/lib/config');
const { getValidEnv } = require('@hubspot/cli-lib/lib/environment');

const i18nKey = 'cli.lib.sandbox.create';

/**
 * @param {String} name - Name of sandbox
 * @param {String} type - Sandbox type to be created (standard/developer)
 * @param {Object} accountConfig - Account config of parent portal
 * @param {String} env - Environment (QA/Prod)
 * @param {Boolean} allowEarlyTermination - Option to allow a keypress to terminate early
 * @param {Boolean} allowSyncAssets - Option to allow user to sync assets after creation
 * @param {Boolean} skipDefaultAccountPrompt - Option to skip default account prompt and auto set new sandbox account as default
 * @returns {Object} Object containing sandboxConfigName string and sandbox instance from API
 */
const buildSandbox = async ({
  name,
  type,
  accountConfig,
  env,
  allowEarlyTermination = true,
  allowSyncAssets = true,
  skipDefaultAccountPrompt = false,
  force = false,
}) => {
  const spinnies = new Spinnies({
    succeedColor: 'white',
  });
  const accountId = getAccountId(accountConfig.portalId);

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
        sandboxName: accountConfig.name,
      })
    );
    throw new Error(
      i18n(`${i18nKey}.failure.creatingWithinSandbox`, {
        sandboxType: getSandboxTypeAsString(accountConfig.sandboxAccountType),
        sandboxName: accountConfig.name,
      })
    );
  }

  let typePrompt;
  let namePrompt;

  if ((type && !sandboxTypeMap[type]) || !type) {
    if (!force) {
      typePrompt = await sandboxTypePrompt();
    } else {
      logger.error(i18n(`${i18nKey}.failure.optionMissing.type`));
      throw new Error(i18n(`${i18nKey}.failure.optionMissing.type`));
    }
  }
  if (!name) {
    if (!force) {
      namePrompt = await sandboxNamePrompt();
    } else {
      logger.error(i18n(`${i18nKey}.failure.optionMissing.name`));
      throw new Error(i18n(`${i18nKey}.failure.optionMissing.name`));
    }
  }

  const sandboxName = name || namePrompt.name;
  const sandboxType = sandboxTypeMap[type] || sandboxTypeMap[typePrompt.type];

  let result;
  const spinniesI18nKey = `${i18nKey}.loading.${sandboxType}`;

  try {
    spinnies.add('sandboxCreate', {
      text: i18n(`${spinniesI18nKey}.add`, {
        sandboxName,
      }),
    });

    const sandboxApiType = sandboxApiTypeMap[sandboxType]; // API expects sandbox type as 1 or 2
    result = await createSandbox(accountId, sandboxName, sandboxApiType);

    spinnies.succeed('sandboxCreate', {
      text: i18n(`${spinniesI18nKey}.succeed`, {
        name: result.name,
        sandboxHubId: result.sandboxHubId,
      }),
    });
  } catch (err) {
    debugErrorAndContext(err);

    trackCommandUsage('sandbox-create', { successful: false }, accountId);

    spinnies.fail('sandboxCreate', {
      text: i18n(`${spinniesI18nKey}.fail`, {
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
      isSpecifiedError(
        err,
        400,
        'VALIDATION_ERROR',
        'SandboxErrors.NUM_STANDARD_SANDBOXES_LIMIT_EXCEEDED_ERROR'
      ) &&
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

  if (skipDefaultAccountPrompt || force) {
    updateDefaultAccount(sandboxConfigName);
  } else {
    const setAsDefault = await setAsDefaultAccountPrompt(sandboxConfigName);
    if (setAsDefault) {
      logger.success(
        i18n(`cli.lib.prompts.setAsDefaultAccountPrompt.setAsDefaultAccount`, {
          accountName: sandboxConfigName,
        })
      );
    } else {
      const config = getConfig();
      logger.info(
        i18n(
          `cli.lib.prompts.setAsDefaultAccountPrompt.keepingCurrentDefault`,
          {
            accountName: config.defaultPortal,
          }
        )
      );
    }
  }

  // If creating standard sandbox, prompt user to sync assets
  if (allowSyncAssets) {
    if (sandboxType === STANDARD_SANDBOX) {
      const syncI18nKey = 'cli.lib.sandbox.sync';
      const sandboxAccountConfig = getAccountConfig(
        result.sandbox.sandboxHubId
      );
      const handleSyncSandbox = async () => {
        await syncSandbox({
          accountConfig: sandboxAccountConfig,
          parentAccountConfig: accountConfig,
          env,
          allowEarlyTermination,
        });
      };
      try {
        logger.log('');
        if (!force) {
          const { sandboxSyncPrompt } = await promptUser([
            {
              name: 'sandboxSyncPrompt',
              type: 'confirm',
              message: i18n(
                `${syncI18nKey}.confirm.standardSandboxCreateFlow`,
                {
                  parentAccountName: getAccountName(accountConfig),
                  sandboxName: getAccountName(sandboxAccountConfig),
                }
              ),
            },
          ]);
          if (sandboxSyncPrompt) {
            await handleSyncSandbox();
          }
        } else {
          await handleSyncSandbox();
        }
      } catch (err) {
        logErrorInstance(err);
        throw err;
      }
    }
  }

  return {
    sandboxConfigName,
    result,
  };
};

module.exports = {
  buildSandbox,
};

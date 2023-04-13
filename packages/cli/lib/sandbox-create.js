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
  getAccountName,
  STANDARD_SANDBOX,
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
const { getEnv, getAccountConfig, getConfig } = require('@hubspot/cli-lib');
const { createSandbox } = require('@hubspot/cli-lib/sandboxes');
const { promptUser } = require('./prompts/promptUtils');
const { EXIT_CODES } = require('./enums/exitCodes');
const { syncSandbox } = require('./sandbox-sync');
const {
  setAsDefaultAccountPrompt,
} = require('./prompts/setAsDefaultAccountPrompt');
const { updateDefaultAccount } = require('@hubspot/cli-lib/lib/config');

const i18nKey = 'cli.commands.sandbox.subcommands.create';

/**
 * @param {String} name - Name of sandbox
 * @param {String} type - Standard or development sandbox type
 * @param {Object} accountConfig - Account config of parent portal
 * @param {String} env - Environment (QA/Prod)
 * @param {Boolean} allowEarlyTermination - Option to allow a keypress to terminate early
 * @param {Boolean} skipDefaultAccountPrompt - Option to skip prompt and auto set account as default
 * @returns {Object} sandboxConfigName string and sandbox instance from API
 */
const buildSandbox = async ({
  name,
  type,
  accountConfig,
  env,
  allowEarlyTermination = true,
  skipDefaultAccountPrompt = false,
}) => {
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

  let sandboxConfigName;

  try {
    // Response contains PAK, save to config here
    sandboxConfigName = await saveSandboxToConfig(env, result);
  } catch (err) {
    logErrorInstance(err);
    throw err;
  }

  if (skipDefaultAccountPrompt) {
    updateDefaultAccount(sandboxConfigName);
  } else {
    const setAsDefault = await setAsDefaultAccountPrompt(sandboxConfigName);
    logger.log('');
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
  if (sandboxType === STANDARD_SANDBOX) {
    try {
      const syncI18nKey = 'cli.commands.sandbox.subcommands.sync';
      const sandboxAccountConfig = getAccountConfig(
        result.sandbox.sandboxHubId
      );
      const standardSyncUrl = `${getHubSpotWebsiteOrigin(
        env
      )}/sandboxes-developer/${accountId}/sync?step=select_sync_path&id=${accountId}_${
        result.sandbox.sandboxHubId
      }`;
      const { sandboxSyncPrompt } = await promptUser([
        {
          name: 'sandboxSyncPrompt',
          type: 'confirm',
          message: i18n(`${syncI18nKey}.confirm.standardSandboxCreateFlow`, {
            parentAccountName: getAccountName(accountConfig),
            sandboxName: getAccountName(sandboxAccountConfig),
          }),
        },
      ]);
      if (!sandboxSyncPrompt) {
        process.exit(EXIT_CODES.SUCCESS);
      }
      logger.log('');
      logger.log(
        i18n(`${syncI18nKey}.info.standardSandbox`, {
          url: standardSyncUrl,
        })
      );
      logger.log('');
      const { confirmSandboxSyncPrompt } = await promptUser([
        {
          name: 'confirmSandboxSyncPrompt',
          type: 'confirm',
          message: i18n(
            `${syncI18nKey}.confirm.standardSandboxCreateFlowReconfirm`,
            {
              parentAccountName: getAccountName(accountConfig),
              sandboxName: getAccountName(sandboxAccountConfig),
            }
          ),
        },
      ]);
      if (!confirmSandboxSyncPrompt) {
        process.exit(EXIT_CODES.SUCCESS);
      }
      await syncSandbox({
        accountConfig: sandboxAccountConfig,
        parentAccountConfig: accountConfig,
        env,
        allowEarlyTermination,
      });
    } catch (err) {
      logErrorInstance(err);
      throw err;
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

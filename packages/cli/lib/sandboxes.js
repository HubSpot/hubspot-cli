const { i18n } = require('./lang');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  getSandboxUsageLimits,
} = require('@hubspot/local-dev-lib/api/sandboxHubs');
const { fetchTypes } = require('@hubspot/local-dev-lib/api/sandboxSync');
const {
  getConfig,
  getAccountId,
  getEnv,
} = require('@hubspot/local-dev-lib/config');
const { promptUser } = require('./prompts/promptUtils');
const { isDevelopmentSandbox } = require('./accountTypes');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const {
  HUBSPOT_ACCOUNT_TYPES,
} = require('@hubspot/local-dev-lib/constants/config');
const { uiAccountDescription } = require('./ui');
const {
  isMissingScopeError,
  isSpecifiedError,
} = require('@hubspot/local-dev-lib/errors/index');
const { getValidEnv } = require('@hubspot/local-dev-lib/environment');
const { logError } = require('./errorHandlers/index');

const syncTypes = {
  OBJECT_RECORDS: 'object-records',
};

const sandboxTypeMap = {
  dev: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
  developer: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
  development: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
  standard: HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
};

const sandboxApiTypeMap = {
  [HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX]: 1,
  [HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX]: 2,
};

const getSandboxTypeAsString = accountType => {
  if (accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX) {
    return 'development'; // Only place we're using this specific name
  }
  return 'standard';
};

function getHasSandboxesByType(parentAccountConfig, type) {
  const config = getConfig();
  const parentPortalId = getAccountId(parentAccountConfig.portalId);
  for (const portal of config.portals) {
    if (
      (portal.parentAccountId !== null ||
        portal.parentAccountId !== undefined) &&
      portal.parentAccountId === parentPortalId &&
      portal.accountType &&
      portal.accountType === type
    ) {
      return true;
    }
  }
  return false;
}

function getSandboxLimit(error) {
  // Error context should contain a limit property with a list of one number. That number is the current limit
  const limit = error.context && error.context.limit && error.context.limit[0];
  return limit ? parseInt(limit, 10) : 1; // Default to 1
}

// Fetches available sync types for a given sandbox portal
async function getAvailableSyncTypes(parentAccountConfig, config) {
  const parentPortalId = getAccountId(parentAccountConfig.portalId);
  const portalId = getAccountId(config.portalId);
  const {
    data: { results: syncTypes },
  } = await fetchTypes(parentPortalId, portalId);
  if (!syncTypes) {
    throw new Error(
      'Unable to fetch available sandbox sync types. Please try again.'
    );
  }
  return syncTypes.map(t => ({ type: t.name }));
}

/**
 * @param {Object} accountConfig - Account config of sandbox portal
 * @param {Array} availableSyncTasks - Array of available sync tasks
 * @param {Boolean} skipPrompt - Option to skip contact records prompt and return all available sync tasks
 * @returns {Array} Adjusted available sync task items
 */
const getSyncTypesWithContactRecordsPrompt = async (
  accountConfig,
  syncTasks,
  skipPrompt = false
) => {
  // TODO: remove this entire helper once hs sandbox sync is fully deprecated
  const isDevSandbox = isDevelopmentSandbox(accountConfig);
  if (isDevSandbox) {
    // Disable dev sandbox from syncing contacts
    return syncTasks.filter(t => t.type !== syncTypes.OBJECT_RECORDS);
  }
  if (
    syncTasks &&
    syncTasks.some(t => t.type === syncTypes.OBJECT_RECORDS) &&
    !skipPrompt
  ) {
    const { contactRecordsSyncPrompt } = await promptUser([
      {
        name: 'contactRecordsSyncPrompt',
        type: 'confirm',
        message: i18n('lib.sandbox.sync.confirm.syncContactRecords.standard'),
      },
    ]);
    if (!contactRecordsSyncPrompt) {
      return syncTasks.filter(t => t.type !== syncTypes.OBJECT_RECORDS);
    }
  }
  return syncTasks;
};

/**
 * @param {Object} accountConfig - Account config of sandbox portal
 * @param {String} sandboxType - Sandbox type for limit validation
 * @param {String} env - Environment
 * @returns {null}
 */
const validateSandboxUsageLimits = async (accountConfig, sandboxType, env) => {
  const accountId = getAccountId(accountConfig.portalId);
  const {
    data: { usage },
  } = await getSandboxUsageLimits(accountId);
  if (!usage) {
    throw new Error('Unable to fetch sandbox usage limits. Please try again.');
  }
  if (sandboxType === HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX) {
    if (usage['DEVELOPER'].available === 0) {
      const devSandboxLimit = usage['DEVELOPER'].limit;
      const plural = devSandboxLimit !== 1;
      const hasDevelopmentSandboxes = getHasSandboxesByType(
        accountConfig,
        HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX
      );
      if (hasDevelopmentSandboxes) {
        throw new Error(
          i18n(
            `lib.sandbox.create.failure.alreadyInConfig.developer.${
              plural ? 'other' : 'one'
            }`,
            {
              accountName: accountConfig.name || accountId,
              limit: devSandboxLimit,
            }
          )
        );
      } else {
        const baseUrl = getHubSpotWebsiteOrigin(env);
        throw new Error(
          i18n(
            `lib.sandbox.create.failure.limit.developer.${
              plural ? 'other' : 'one'
            }`,
            {
              accountName: accountConfig.name || accountId,
              limit: devSandboxLimit,
              link: `${baseUrl}/sandboxes-developer/${accountId}/development`,
            }
          )
        );
      }
    }
  }
  if (sandboxType === HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX) {
    if (usage['STANDARD'].available === 0) {
      const standardSandboxLimit = usage['STANDARD'].limit;
      const plural = standardSandboxLimit !== 1;
      const hasStandardSandboxes = getHasSandboxesByType(
        accountConfig,
        HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX
      );
      if (hasStandardSandboxes) {
        throw new Error(
          i18n(
            `lib.sandbox.create.failure.alreadyInConfig.standard.${
              plural ? 'other' : 'one'
            }`,
            {
              accountName: accountConfig.name || accountId,
              limit: standardSandboxLimit,
            }
          )
        );
      } else {
        const baseUrl = getHubSpotWebsiteOrigin(env);
        throw new Error(
          i18n(
            `lib.sandbox.create.failure.limit.standard.${
              plural ? 'other' : 'one'
            }`,
            {
              accountName: accountConfig.name || accountId,
              limit: standardSandboxLimit,
              link: `${baseUrl}/sandboxes-developer/${accountId}/standard`,
            }
          )
        );
      }
    }
  }
};

function handleSandboxCreateError({
  err,
  env,
  accountId,
  name,
  accountConfig,
}) {
  if (isMissingScopeError(err)) {
    logger.error(
      i18n('lib.sandboxes.create.failure.scopes.message', {
        accountName: uiAccountDescription(accountId),
      })
    );
    const websiteOrigin = getHubSpotWebsiteOrigin(env);
    const url = `${websiteOrigin}/personal-access-key/${accountId}`;
    logger.info(
      i18n('lib.sandboxes.create.failure.scopes.instructions', {
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
      i18n('lib.sandboxes.create.failure.invalidUser', {
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
      i18n('lib.sandboxes.create.failure.403Gating', {
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
          `lib.sandboxes.create.failure.alreadyInConfig.developer.${
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
          `lib.sandboxes.create.failure.limit.developer.${
            plural ? 'other' : 'one'
          }`,
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
      subCategory: 'SandboxErrors.NUM_STANDARD_SANDBOXES_LIMIT_EXCEEDED_ERROR',
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
          `lib.sandboxes.create.failure.alreadyInConfig.standard.${
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
          `lib.sandboxes.create.failure.limit.standard.${
            plural ? 'other' : 'one'
          }`,
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
    logError(err);
  }
  throw err;
}

module.exports = {
  sandboxTypeMap,
  sandboxApiTypeMap,
  syncTypes,
  getSandboxTypeAsString,
  getHasSandboxesByType,
  getSandboxLimit,
  validateSandboxUsageLimits,
  getAvailableSyncTypes,
  getSyncTypesWithContactRecordsPrompt,
  handleSandboxCreateError,
};

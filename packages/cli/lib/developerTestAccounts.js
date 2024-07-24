const {
  HUBSPOT_ACCOUNT_TYPES,
} = require('@hubspot/local-dev-lib/constants/config');
const { getAccountId, getConfig } = require('@hubspot/local-dev-lib/config');
const { i18n } = require('./lang');
const {
  fetchDeveloperTestAccounts,
} = require('@hubspot/local-dev-lib/developerTestAccounts');
const {
  isMissingScopeError,
  isSpecifiedError,
} = require('@hubspot/local-dev-lib/errors/index');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { uiAccountDescription } = require('./ui');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const { logErrorInstance } = require('./errorHandlers/standardErrors');

const getHasDevTestAccounts = appDeveloperAccountConfig => {
  const config = getConfig();
  const parentPortalId = getAccountId(appDeveloperAccountConfig.portalId);
  for (const portal of config.portals) {
    if (
      Boolean(portal.parentAccountId) &&
      portal.parentAccountId === parentPortalId &&
      portal.accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST
    ) {
      return true;
    }
  }
  return false;
};

const validateDevTestAccountUsageLimits = async accountConfig => {
  const accountId = getAccountId(accountConfig.portalId);
  const response = await fetchDeveloperTestAccounts(accountId);
  if (response) {
    const limit = response.maxTestPortals;
    const count = response.results.length;
    if (count >= limit) {
      const hasDevTestAccounts = getHasDevTestAccounts(accountConfig);
      if (hasDevTestAccounts) {
        throw new Error(
          i18n('lib.developerTestAccount.create.failure.alreadyInConfig', {
            accountName: accountConfig.name || accountId,
            limit,
          })
        );
      } else {
        throw new Error(
          i18n('lib.developerTestAccount.create.failure.limit', {
            accountName: accountConfig.name || accountId,
            limit,
          })
        );
      }
    }
    return response;
  }
  return null;
};

function handleDeveloperTestAccountCreateError({
  err,
  accountId,
  env,
  portalLimit,
}) {
  if (isMissingScopeError(err)) {
    logger.error(
      i18n('lib.developerTestAccount.create.failure.scopes.message', {
        accountName: uiAccountDescription(accountId),
      })
    );
    const websiteOrigin = getHubSpotWebsiteOrigin(env);
    const url = `${websiteOrigin}/personal-access-key/${accountId}`;
    logger.info(
      i18n('lib.developerTestAccount.create.failure.scopes.instructions', {
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
      i18n('lib.developerTestAccount.create.failure.limit', {
        accountName: uiAccountDescription(accountId),
        limit: portalLimit,
      })
    );
    logger.log('');
  } else {
    logErrorInstance(err);
  }
  throw err;
}

module.exports = {
  validateDevTestAccountUsageLimits,
  handleDeveloperTestAccountCreateError,
};

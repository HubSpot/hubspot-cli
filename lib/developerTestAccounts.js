const {
  HUBSPOT_ACCOUNT_TYPES,
} = require('@hubspot/local-dev-lib/constants/config');
const { getAccountId, getConfig } = require('@hubspot/local-dev-lib/config');
const { i18n } = require('./lang');
const {
  fetchDeveloperTestAccounts,
} = require('@hubspot/local-dev-lib/api/developerTestAccounts');
const {
  isMissingScopeError,
  isSpecifiedError,
} = require('@hubspot/local-dev-lib/errors/index');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { uiAccountDescription } = require('./ui');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const { logError } = require('./errorHandlers/index');

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
  const { data } = await fetchDeveloperTestAccounts(accountId);
  if (!data) {
    return null;
  }
  const limit = data.maxTestPortals;
  const count = data.results.length;
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
  return data;
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
    logError(err);
  }
  throw err;
}

module.exports = {
  validateDevTestAccountUsageLimits,
  handleDeveloperTestAccountCreateError,
};

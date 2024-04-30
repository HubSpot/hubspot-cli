const {
  HUBSPOT_ACCOUNT_TYPES,
} = require('@hubspot/local-dev-lib/constants/config');
const { getAccountId, getConfig } = require('@hubspot/local-dev-lib/config');
const { i18n } = require('./lang');
const {
  fetchDeveloperTestAccounts,
} = require('@hubspot/local-dev-lib/developerTestAccounts');

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

const i18nKey = 'lib.developerTestAccount';

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
          i18n(`${i18nKey}.create.failure.alreadyInConfig`, {
            accountName: accountConfig.name || accountId,
            limit,
          })
        );
      } else {
        throw new Error(
          i18n(`${i18nKey}.create.failure.limit`, {
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
module.exports = {
  validateDevTestAccountUsageLimits,
};

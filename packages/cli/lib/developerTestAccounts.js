const {
  HUBSPOT_ACCOUNT_TYPES,
} = require('@hubspot/local-dev-lib/constants/config');

const isDeveloperTestAccount = config =>
  config.accountType &&
  config.accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST;

const isAppDeveloperAccount = config =>
  config.accountType &&
  config.accountType === HUBSPOT_ACCOUNT_TYPES.APP_DEVELOPER;

module.exports = {
  isDeveloperTestAccount,
  isAppDeveloperAccount,
};

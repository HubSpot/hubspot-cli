const {
  HUBSPOT_ACCOUNT_TYPES,
} = require('@hubspot/local-dev-lib/constants/config');

const isDeveloperTestAccount = config =>
  config.accountType &&
  config.accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST;

module.exports = {
  isDeveloperTestAccount,
};

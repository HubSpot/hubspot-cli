const {
  HUBSPOT_ACCOUNT_TYPES,
} = require('@hubspot/local-dev-lib/constants/config');

const DEV_TEST_ACCOUNT_STRING = 'developer test account';

const isDeveloperTestAccount = config =>
  config.accountType &&
  config.accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST;

module.exports = {
  DEV_TEST_ACCOUNT_STRING,
  isDeveloperTestAccount,
};

const {
  HUBSPOT_ACCOUNT_TYPES,
} = require('@hubspot/local-dev-lib/constants/config');

const isAccountType = (config, accountType) =>
  config.accountType && config.accountType === accountType;

const isStandardAccount = config =>
  isAccountType(config, HUBSPOT_ACCOUNT_TYPES.STANDARD);

const isSandbox = config =>
  isAccountType(config, HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX) ||
  isAccountType(config, HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX);

const isStandardSandbox = config =>
  isAccountType(config, HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX);

const isDevelopmentSandbox = config =>
  isAccountType(config, HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX);

const isDeveloperTestAccount = config =>
  isAccountType(config, HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST);

const isAppDeveloperAccount = config =>
  isAccountType(config, HUBSPOT_ACCOUNT_TYPES.APP_DEVELOPER);

module.exports = {
  isStandardAccount,
  isSandbox,
  isStandardSandbox,
  isDevelopmentSandbox,
  isDeveloperTestAccount,
  isAppDeveloperAccount,
};

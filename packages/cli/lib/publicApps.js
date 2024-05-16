const {
  fetchPublicAppOptions,
  selectPublicAppPrompt,
} = require('./prompts/selectPublicAppPrompt');
const { EXIT_CODES } = require('./enums/exitCodes');
const { i18n } = require('./lang');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  migrateApp,
  checkMigrationStatus,
} = require('@hubspot/local-dev-lib/api/projects');

const i18nKey = 'cli.lib.publicApps';

const fetchPublicApp = async (accountId, accountName, options, migrateApp) => {
  const { appId } = await selectPublicAppPrompt({
    accountId,
    accountName,
    options,
    migrateApp,
  });
  return appId;
};

const migratePublicApp = async (accountId, appId, name) => {
  const response = await migrateApp(accountId, appId, name);
  return response;
};

const getMigrationStatus = async (accountId, id) => {
  const response = await checkMigrationStatus(accountId, id);
  return response;
};

const validateAppId = async (appId, accountId, accountName) => {
  const publicApps = await fetchPublicAppOptions(accountId, accountName);
  if (!publicApps.find(a => a.id === appId)) {
    logger.error(i18n(`${i18nKey}.errors.invalidAppId`, { appId }));
    process.exit(EXIT_CODES.ERROR);
  }
};

module.exports = {
  migratePublicApp,
  getMigrationStatus,
  fetchPublicApp,
  validateAppId,
};

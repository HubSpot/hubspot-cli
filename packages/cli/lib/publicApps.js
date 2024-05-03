const {
  fetchPublicAppOptions,
  selectPublicAppPrompt,
} = require('./prompts/selectPublicAppPrompt');
const { EXIT_CODES } = require('./enums/exitCodes');
const { i18n } = require('./lang');
const { logger } = require('@hubspot/local-dev-lib/logger');

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

const migratePublicApp = async (appId, name, location) => {
  console.log('Migrating appId', appId);
  console.log('Name:', name);
  console.log('Location:', location);
  return;
};

const clonePublicApp = async appId => {
  console.log('Cloning appId', appId);
  return;
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
  clonePublicApp,
  fetchPublicApp,
  validateAppId,
};

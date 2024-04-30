const {
  fetchPublicAppOptions,
  selectPublicAppPrompt,
} = require('./prompts/selectPublicAppPrompt');
const { EXIT_CODES } = require('./enums/exitCodes');
const { i18n } = require('./lang');
const { logger } = require('@hubspot/local-dev-lib/logger');

const i18nKey = 'cli.lib.publicApps';

const fetchPublicApp = async (
  migrateApp,
  cloneApp,
  options,
  accountId,
  accountName
) => {
  if (migrateApp || cloneApp) {
    const { appId } = await selectPublicAppPrompt({
      accountId,
      accountName,
      migrateApp,
      cloneApp,
      options,
    });
    return appId;
  }
};

const migratePublicApp = async appId => {
  console.log('Migrating appId', appId);
  return;
};

const clonePublicApp = async appId => {
  console.log('Cloning appId', appId);
  return;
};

const validateAppId = async (
  appId,
  migrateApp,
  cloneApp,
  accountId,
  accountName
) => {
  if (
    (appId && migrateApp && cloneApp) ||
    (appId && !(migrateApp || cloneApp))
  ) {
    logger.error(i18n(`${i18nKey}.errors.migrateOrCloneUnspecified`));
    process.exit(EXIT_CODES.ERROR);
  }

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
  fetchPublicAppOptions,
  validateAppId,
};

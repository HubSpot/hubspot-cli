const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');
const { uiLine } = require('../ui');
const { logApiErrorInstance } = require('../errorHandlers/apiErrors');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  fetchPublicAppsForPortal,
} = require('@hubspot/local-dev-lib/api/appsDev');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

const i18nKey = 'lib.prompts.selectPublicAppPrompt';

const fetchPublicAppOptions = async (accountId, accountName, migrateApp) => {
  try {
    const publicApps = await fetchPublicAppsForPortal(accountId);
    const filteredPublicApps = publicApps.filter(
      app => !app.projectId && !app.sourceId
    );

    if (
      !filteredPublicApps.length ||
      (migrateApp &&
        !filteredPublicApps.find(app => !app.preventProjectMigrations))
    ) {
      const headerTranslationKey = migrateApp
        ? 'noAppsMigration'
        : 'noAppsClone';
      const messageTranslationKey = migrateApp
        ? 'noAppsMigrationMessage'
        : 'noAppsCloneMessage';
      uiLine();
      logger.error(i18n(`${i18nKey}.errors.${headerTranslationKey}`));
      logger.log(
        i18n(`${i18nKey}.errors.${messageTranslationKey}`, { accountName })
      );
      uiLine();
      process.exit(EXIT_CODES.SUCCESS);
    }
    return filteredPublicApps;
  } catch (error) {
    logApiErrorInstance(error, { accountId });
    logger.error(i18n(`${i18nKey}.errors.errorFetchingApps`));
    process.exit(EXIT_CODES.ERROR);
  }
};

const selectPublicAppPrompt = async ({
  accountId,
  accountName,
  migrateApp = false,
}) => {
  const publicApps = await fetchPublicAppOptions(
    accountId,
    accountName,
    (migrateApp = false)
  );
  const translationKey = migrateApp ? 'selectAppIdMigrate' : 'selectAppIdClone';

  return promptUser([
    {
      name: 'appId',
      message: i18n(`${i18nKey}.${translationKey}`, {
        accountName,
      }),
      type: 'list',
      choices: publicApps.map(app => {
        if (migrateApp && app.preventProjectMigrations) {
          return {
            name: `${app.name} (${app.id})`,
            disabled: i18n(`${i18nKey}.errors.cannotBeMigrated`),
          };
        }
        return {
          name: `${app.name} (${app.id})`,
          value: app.id,
        };
      }),
    },
  ]);
};

module.exports = {
  selectPublicAppPrompt,
};

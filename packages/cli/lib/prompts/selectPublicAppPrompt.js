const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');
const { uiLine } = require('../ui');
const { logError } = require('../errorHandlers/index');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  fetchPublicAppsForPortal,
} = require('@hubspot/local-dev-lib/api/appsDev');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

const i18nKey = 'lib.prompts.selectPublicAppPrompt';

const fetchPublicAppOptions = async (
  accountId,
  accountName,
  isMigratingApp = false
) => {
  try {
    const { data: publicApps } = await fetchPublicAppsForPortal(accountId);
    const filteredPublicApps = publicApps.filter(
      app => !app.projectId && !app.sourceId
    );

    if (
      !filteredPublicApps.length ||
      (isMigratingApp &&
        !filteredPublicApps.some(
          app => !app.preventProjectMigrations || !app.listingInfo
        ))
    ) {
      const headerTranslationKey = isMigratingApp
        ? 'noAppsMigration'
        : 'noAppsClone';
      const messageTranslationKey = isMigratingApp
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
    logError(error, { accountId });
    logger.error(i18n(`${i18nKey}.errors.errorFetchingApps`));
    process.exit(EXIT_CODES.ERROR);
  }
};

const selectPublicAppPrompt = async ({
  accountId,
  accountName,
  isMigratingApp = false,
}) => {
  const publicApps = await fetchPublicAppOptions(
    accountId,
    accountName,
    isMigratingApp
  );
  const translationKey = isMigratingApp
    ? 'selectAppIdMigrate'
    : 'selectAppIdClone';

  return promptUser([
    {
      name: 'appId',
      message: i18n(`${i18nKey}.${translationKey}`, {
        accountName,
      }),
      type: 'list',
      choices: publicApps.map(app => {
        const { preventProjectMigrations, listingInfo } = app;
        if (isMigratingApp && preventProjectMigrations && listingInfo) {
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

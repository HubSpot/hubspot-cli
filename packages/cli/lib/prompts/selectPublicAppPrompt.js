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

const fetchPublicAppOptions = async (accountId, accountName) => {
  try {
    const publicApps = await fetchPublicAppsForPortal(accountId);
    const filteredPublicApps = publicApps.filter(
      app => !app.projectId && !app.sourceId
    );

    if (!filteredPublicApps.length) {
      uiLine();
      logger.error(i18n(`${i18nKey}.errors.noApps`));
      logger.log(i18n(`${i18nKey}.errors.noAppsMessage`, { accountName }));
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
  migrateApp = false,
}) => {
  const publicApps = await fetchPublicAppOptions(accountId, accountName);
  const translationKey = migrateApp ? 'selectAppIdMigrate' : 'selectAppIdClone';

  return promptUser([
    {
      name: 'appId',
      message: i18n(`${i18nKey}.${translationKey}`, {
        accountName,
      }),
      type: 'list',
      choices: publicApps.map(app => {
        if (app.listingInfo) {
          return {
            name: `${app.name} (${app.id})`,
            disabled: i18n(`${i18nKey}.errors.marketplaceApp`),
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
  fetchPublicAppOptions,
  selectPublicAppPrompt,
};

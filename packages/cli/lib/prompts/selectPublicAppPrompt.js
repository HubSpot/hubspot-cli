const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { fetchPublicApps } = require('@hubspot/local-dev-lib/api/appsDev');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

const i18nKey = 'cli.lib.prompts.selectPublicAppPrompt';

const fetchPublicAppOptions = async (accountId, accountName) => {
  try {
    const publicApps = await fetchPublicApps(accountId);

    if (!publicApps.length) {
      logger.error(
        i18n(`${i18nKey}.errors.noPublicAppsInAccount`, { accountName })
      );
      process.exit(EXIT_CODES.ERROR);
    }
    return publicApps;
  } catch (error) {
    logger.error(i18n(`${i18nKey}.errors.errorFetchingApps`));
    process.exit(EXIT_CODES.ERROR);
  }
};

const selectPublicAppPrompt = async ({
  accountId,
  accountName,
  migrateApp,
  cloneApp,
  promptOptions = {},
}) => {
  const publicApps = await fetchPublicAppOptions(accountId, accountName);
  const translationKey = migrateApp
    ? 'selectAppIdMigrate'
    : cloneApp
    ? 'selectAppIdClone'
    : '';

  return promptUser([
    {
      name: 'appId',
      message: () => {
        return promptOptions.appId &&
          !publicApps.find(a => a.id === promptOptions.appId)
          ? i18n(`${i18nKey}.errors.invalidAppId`, {
              appId: promptOptions.appId,
            })
          : i18n(`${i18nKey}.${translationKey}`, {
              accountName,
            });
      },
      when:
        !promptOptions.appId ||
        !publicApps.find(a => a.id === promptOptions.appId),
      type: 'list',
      choices: publicApps.map(app => {
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

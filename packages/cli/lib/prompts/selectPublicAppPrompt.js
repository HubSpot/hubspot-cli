const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

const i18nKey = 'cli.lib.prompts.selectPublicAppPrompt';

const fetchPublicAppOptions = async accountId => {
  console.log('accountId', accountId);
  return Promise.resolve([
    {
      id: 8968688,
      name: 'Getting Started App',
      description:
        'An example project of how to build a Public App with Developer Projects',
      portalId: 892058400,
      updatedAt: 1713382701719,
      createdAt: 1713380475769,
      clientId: 'dbfd23e8-4ecb-4348-8125-bffd62fc3298',
      iconUrl: null,
      archived: false,
      ownerId: 2138143,
      isUserLevel: false,
      isBusinessUnitEnabled: false,
      isFeatured: false,
      isInternal: false,
      documentationUrl: 'https://example.com/docs',
      supportUrl: 'https://example.com/support',
      supportEmail: 'support@example.com',
      supportPhone: '1-800-555-5555',
      extensionIconUrl: null,
      isAdvancedScopesSettingEnabled: true,
    },
  ]);
};

const selectPublicAppPrompt = async ({
  accountId,
  accountName,
  promptOptions = {},
}) => {
  try {
    const publicApps = await fetchPublicAppOptions(accountId);

    if (!publicApps.length) {
      logger.error(
        i18n(`${i18nKey}.errors.noPublicAppsInAccount`, { accountName })
      );
      process.exit(EXIT_CODES.ERROR);
    }

    return promptUser([
      {
        name: 'appId',
        message: () => {
          return promptOptions.appId &&
            !publicApps.find(a => a.id === promptOptions.appId)
            ? i18n(`${i18nKey}.errors.invalidAppId`, {
                appId: promptOptions.appId,
              })
            : i18n(`${i18nKey}.selectAppId`, {
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
  } catch (error) {
    logger.error(i18n(`${i18nKey}.errors.errorFetchingApps`));
    process.exit(EXIT_CODES.ERROR);
  }
};

module.exports = {
  selectPublicAppPrompt,
};

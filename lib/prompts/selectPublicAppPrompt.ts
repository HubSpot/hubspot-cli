import { promptUser } from './promptUtils';
import { i18n } from '../lang';
import { uiLine } from '../ui';
import { logError } from '../errorHandlers/index';
import { logger } from '@hubspot/local-dev-lib/logger';
import { fetchPublicAppsForPortal } from '@hubspot/local-dev-lib/api/appsDev';
import { EXIT_CODES } from '../enums/exitCodes';
import { PublicApp } from '@hubspot/local-dev-lib/types/Apps';

const i18nKey = 'lib.prompts.selectPublicAppPrompt';

type PublicAppPromptResponse = {
  appId: number;
};

async function fetchPublicAppOptions(
  accountId: number | null,
  accountName: string,
  isMigratingApp = false
): Promise<PublicApp[]> {
  try {
    let publicApps: PublicApp[] = [];
    if (accountId) {
      const {
        data: { results: apps },
      } = await fetchPublicAppsForPortal(accountId);
      publicApps = apps;
    }
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
    if (accountId) {
      logError(error, { accountId });
    } else {
      logError(error);
    }
    logger.error(i18n(`${i18nKey}.errors.errorFetchingApps`));
    process.exit(EXIT_CODES.ERROR);
  }
}

export async function selectPublicAppPrompt({
  accountId,
  accountName,
  isMigratingApp = false,
}: {
  accountId: number | null;
  accountName: string;
  isMigratingApp?: boolean;
}): Promise<PublicAppPromptResponse> {
  const publicApps: PublicApp[] = await fetchPublicAppOptions(
    accountId,
    accountName,
    isMigratingApp
  );
  const translationKey = isMigratingApp
    ? 'selectAppIdMigrate'
    : 'selectAppIdClone';

  return promptUser<PublicAppPromptResponse>([
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
}

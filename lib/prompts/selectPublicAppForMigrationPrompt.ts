import { promptUser } from './promptUtils.js';
import { lib } from '../../lang/en.js';
import { uiLine } from '../ui/index.js';
import { logError } from '../errorHandlers/index.js';
import { uiLogger } from '../ui/logger.js';
import { fetchPublicAppsForPortal } from '@hubspot/local-dev-lib/api/appsDev';
import { EXIT_CODES } from '../enums/exitCodes.js';
import { PublicApp } from '@hubspot/local-dev-lib/types/Apps';

type PublicAppPromptResponse = {
  appId: number;
};

async function fetchPublicAppOptions(
  accountId: number | null,
  accountName: string,
  isMigratingApp = false
): Promise<PublicApp[]> {
  try {
    if (!accountId) {
      uiLogger.error(
        lib.prompts.selectPublicAppForMigrationPrompt.errors.noAccountId
      );
      process.exit(EXIT_CODES.ERROR);
    }

    const {
      data: { results: publicApps },
    } = await fetchPublicAppsForPortal(accountId);

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
      uiLine();
      if (isMigratingApp) {
        uiLogger.error(
          `${lib.prompts.selectPublicAppForMigrationPrompt.errors.noAppsMigration}\n${lib.prompts.selectPublicAppForMigrationPrompt.errors.noAppsMigrationMessage(accountName)}`
        );
      } else {
        uiLogger.error(
          `${lib.prompts.selectPublicAppForMigrationPrompt.errors.noAppsClone}\n${lib.prompts.selectPublicAppForMigrationPrompt.errors.noAppsCloneMessage(accountName)}`
        );
      }
      uiLine();
      process.exit(EXIT_CODES.SUCCESS);
    }
    return filteredPublicApps;
  } catch (error) {
    logError(error, accountId ? { accountId } : undefined);
    uiLogger.error(
      lib.prompts.selectPublicAppForMigrationPrompt.errors.errorFetchingApps
    );
    process.exit(EXIT_CODES.ERROR);
  }
}

export async function selectPublicAppForMigrationPrompt({
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
  return promptUser<PublicAppPromptResponse>([
    {
      name: 'appId',
      message: isMigratingApp
        ? lib.prompts.selectPublicAppForMigrationPrompt.selectAppIdMigrate(
            accountName
          )
        : lib.prompts.selectPublicAppForMigrationPrompt.selectAppIdClone(
            accountName
          ),
      type: 'list',
      choices: publicApps.map(app => {
        const { preventProjectMigrations, listingInfo } = app;
        if (isMigratingApp && preventProjectMigrations && listingInfo) {
          return {
            name: `${app.name} (${app.id})`,
            disabled:
              lib.prompts.selectPublicAppForMigrationPrompt.errors
                .cannotBeMigrated,
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

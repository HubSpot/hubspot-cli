import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { inputPrompt, listPrompt, promptUser } from '../prompts/promptUtils';
import { ApiErrorContext, logError } from '../errorHandlers';
import { EXIT_CODES } from '../enums/exitCodes';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  uiAccountDescription,
  uiBetaTag,
  uiCommandReference,
  uiLine,
  uiLink,
} from '../ui';
import { i18n } from '../lang';
import { isAppDeveloperAccount } from '../accountTypes';
import { selectPublicAppPrompt } from '../prompts/selectPublicAppPrompt';
import { fetchPublicAppMetadata } from '@hubspot/local-dev-lib/api/appsDev';
import { createProjectPrompt } from '../prompts/createProjectPrompt';
import { ensureProjectExists } from '../projects';
import { trackCommandMetadataUsage } from '../usageTracking';
import SpinniesManager from '../ui/SpinniesManager';
import { handleKeypress } from '../process';
import {
  checkMigrationStatus,
  downloadProject,
  migrateApp,
} from '@hubspot/local-dev-lib/api/projects';
import { poll } from '../polling';
import path from 'path';
import { getCwd, sanitizeFileName } from '@hubspot/local-dev-lib/path';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { extractZipArchive } from '@hubspot/local-dev-lib/archive';
import { ArgumentsCamelCase } from 'yargs';
import { MigrateAppOptions } from '../../types/Yargs';

export async function migrateApp2025_2(
  derivedAccountId: number,
  accountConfig: CLIAccount,
  options: ArgumentsCamelCase<MigrateAppOptions>
) {
  SpinniesManager.init();

  console.log(accountConfig);
  console.log(options);
  // let appId: number;

  const { apps } = await getEligibleApps(derivedAccountId);

  if (apps.length === 0) {
    logger.info('No apps available to migrate');
    process.exit(EXIT_CODES.SUCCESS);
  }

  const appChoices = apps.map(app => ({
    name: app.name,
    value: app,
    disabled: app.projectName !== undefined ? 'Already migrated' : false,
  }));

  const appToMigrate = await listPrompt<EligibleApp>(
    'Choose the app you want to migrate: ',
    {
      choices: appChoices,
    }
  );

  // Make the call to get the list of the non project apps eligible to migrate
  // Prompt the user to select the app to migrate
  // Prompt the user for a project name and destination
  const projectName = await inputPrompt('Enter the name for the project');
  const projectDest = await inputPrompt(
    'Where do you want to save the project?: '
  );

  SpinniesManager.add('beginningMigration', {
    text: 'Beginning migration',
  });

  // Call the migration end points
  const { migrationId, uidsRequired } = await beginMigration(
    appToMigrate.appId
  );

  SpinniesManager.succeed('beginningMigration', {
    text: 'Migration started',
  });

  const uidMap: Record<string, string> = {};

  if (uidsRequired.length !== 0) {
    for (const u of uidsRequired) {
      uidMap[u] = await inputPrompt(`Give me a uid for ${u}: `);
    }
  }

  let buildId: number;
  let projectId: number;

  try {
    SpinniesManager.add('finishingMigration', {
      text: 'Finalizing migration',
    });
    const migration = await finishMigration(migrationId, uidMap, projectName);
    projectId = migration.projectId;
    buildId = migration.buildId;
    // Poll using the projectId and the build id?
    SpinniesManager.succeed('finishingMigration', {
      text: 'Migration Successful',
    });
  } catch (error) {
    logError(error);
    process.exit(EXIT_CODES.ERROR);
  }

  SpinniesManager.add('fetchingMigratedProject', {
    text: 'Fetching migrated project',
  });
  await fetchProjectSource(projectId, buildId);
  SpinniesManager.succeed('fetchingMigratedProject', {
    text: 'Migrated project fetched',
  });

  // TODO: Actually save it
  logger.success(`Saved ${projectName} to ${projectDest}`);
}

interface MigrationStageOneResponse {
  migrationId: number;
  uidsRequired: string[];
}

interface EligibleApp {
  name: string;
  appId: number;
  projectName?: string;
}

interface EligibleAppsResponse {
  apps: EligibleApp[];
}

export async function getEligibleApps(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  appId: number
): Promise<EligibleAppsResponse> {
  return new Promise(async resolve => {
    setTimeout(() => {
      resolve({
        apps: [
          {
            name: 'App 1',
            appId: 1,
          },
          {
            name: 'App 2',
            appId: 2,
            projectName: 'Project 2',
          },
          {
            name: 'App 3 - No uids required ',
            appId: 3,
          },
        ],
      });
    }, 150);
  });
}

export async function beginMigration(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  appId: number
): Promise<MigrationStageOneResponse> {
  return new Promise(async resolve => {
    setTimeout(() => {
      if (appId === 1) {
        return resolve({
          migrationId: 1234,
          uidsRequired: [
            'App 1',
            'Serverless function 1',
            'Serverless function 2',
          ],
        });
      }
      resolve({
        migrationId: 1234,
        uidsRequired: [],
      });
    }, 1500);
  });
}

type MigrationFinishResponse = {
  projectName: string;
  projectId: number;
  buildId: number;
};

export async function finishMigration(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  migrationId: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  uidMap: Record<string, string>,
  projectName: string
): Promise<MigrationFinishResponse> {
  return new Promise(async resolve => {
    setTimeout(() => {
      resolve({
        projectName,
        projectId: 8675309,
        buildId: 1234,
      });
    }, 2000);
  });
}

export async function fetchProjectSource(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  __projectId: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  __buildId: number
) {
  return new Promise(async resolve => {
    setTimeout(() => {
      resolve({
        source: 'console.log("Hello, World!");',
      });
    }, 1500);
  });
}

export function logInvalidAccountError(i18nKey: string) {
  uiLine();
  logger.error(i18n(`${i18nKey}.errors.invalidAccountTypeTitle`));
  logger.log(
    i18n(`${i18nKey}.errors.invalidAccountTypeDescription`, {
      useCommand: uiCommandReference('hs accounts use'),
      authCommand: uiCommandReference('hs auth'),
    })
  );
  uiLine();
}

export async function migrateApp2023_2(
  accountConfig: CLIAccount,
  options: ArgumentsCamelCase<MigrateAppOptions>,
  derivedAccountId: number
) {
  const i18nKey = 'commands.project.subcommands.migrateApp';
  const accountName = uiAccountDescription(derivedAccountId);
  logger.log('');
  logger.log(uiBetaTag(i18n(`${i18nKey}.header.text`), false));
  logger.log(
    uiLink(
      i18n(`${i18nKey}.header.link`),
      'https://developers.hubspot.com/docs/platform/migrate-a-public-app-to-projects'
    )
  );
  logger.log('');

  if (!isAppDeveloperAccount(accountConfig)) {
    logInvalidAccountError(i18nKey);
    process.exit(EXIT_CODES.SUCCESS);
  }

  const { appId } =
    'appId' in options
      ? options
      : await selectPublicAppPrompt({
          accountId: derivedAccountId,
          accountName,
          isMigratingApp: true,
        });

  try {
    const { data: selectedApp } = await fetchPublicAppMetadata(
      appId,
      derivedAccountId
    );
    // preventProjectMigrations returns true if we have not added app to allowlist config.
    // listingInfo will only exist for marketplace apps
    const preventProjectMigrations = selectedApp.preventProjectMigrations;
    const listingInfo = selectedApp.listingInfo;
    if (preventProjectMigrations && listingInfo) {
      logger.error(i18n(`${i18nKey}.errors.invalidApp`, { appId }));
      process.exit(EXIT_CODES.ERROR);
    }
  } catch (error) {
    logError(error, new ApiErrorContext({ accountId: derivedAccountId }));
    process.exit(EXIT_CODES.ERROR);
  }

  const createProjectPromptResponse = await createProjectPrompt(options);
  const { name: projectName, dest: projectDest } = createProjectPromptResponse;

  const { projectExists } = await ensureProjectExists(
    derivedAccountId,
    projectName,
    {
      allowCreate: false,
      noLogs: true,
    }
  );

  if (projectExists) {
    throw new Error(
      i18n(`${i18nKey}.errors.projectAlreadyExists`, {
        projectName,
      })
    );
  }

  await trackCommandMetadataUsage(
    'migrate-app',
    { status: 'STARTED' },
    derivedAccountId
  );

  logger.log('');
  uiLine();
  logger.warn(`${i18n(`${i18nKey}.warning.title`)}\n`);
  logger.log(i18n(`${i18nKey}.warning.projectConversion`));
  logger.log(`${i18n(`${i18nKey}.warning.appConfig`)}\n`);
  logger.log(`${i18n(`${i18nKey}.warning.buildAndDeploy`)}\n`);
  logger.log(`${i18n(`${i18nKey}.warning.existingApps`)}\n`);
  logger.log(i18n(`${i18nKey}.warning.copyApp`));
  uiLine();

  const { shouldCreateApp } = await promptUser({
    name: 'shouldCreateApp',
    type: 'confirm',
    message: i18n(`${i18nKey}.createAppPrompt`),
  });
  process.stdin.resume();

  if (!shouldCreateApp) {
    process.exit(EXIT_CODES.SUCCESS);
  }

  try {
    SpinniesManager.init();

    SpinniesManager.add('migrateApp', {
      text: i18n(`${i18nKey}.migrationStatus.inProgress`),
    });

    handleKeypress(async key => {
      if ((key.ctrl && key.name === 'c') || key.name === 'q') {
        SpinniesManager.remove('migrateApp');
        logger.log(i18n(`${i18nKey}.migrationInterrupted`));
        process.exit(EXIT_CODES.SUCCESS);
      }
    });

    const { data: migrateResponse } = await migrateApp(
      derivedAccountId,
      appId,
      projectName
    );
    const { id } = migrateResponse;
    const pollResponse = await poll(() =>
      checkMigrationStatus(derivedAccountId, id)
    );
    const { status, project } = pollResponse;
    if (status === 'SUCCESS') {
      const absoluteDestPath = path.resolve(getCwd(), projectDest);
      const { env } = accountConfig;
      const baseUrl = getHubSpotWebsiteOrigin(env);

      const { data: zippedProject } = await downloadProject(
        derivedAccountId,
        projectName,
        1
      );

      await extractZipArchive(
        zippedProject,
        sanitizeFileName(projectName),
        path.resolve(absoluteDestPath),
        { includesRootDir: true, hideLogs: true }
      );

      SpinniesManager.succeed('migrateApp', {
        text: i18n(`${i18nKey}.migrationStatus.done`),
        succeedColor: 'white',
      });
      logger.log('');
      uiLine();
      logger.success(i18n(`${i18nKey}.migrationStatus.success`));
      logger.log('');
      logger.log(
        uiLink(
          i18n(`${i18nKey}.projectDetailsLink`),
          `${baseUrl}/developer-projects/${derivedAccountId}/project/${encodeURIComponent(
            project!.name
          )}`
        )
      );
      process.exit(EXIT_CODES.SUCCESS);
    }
  } catch (error) {
    SpinniesManager.fail('migrateApp', {
      text: i18n(`${i18nKey}.migrationStatus.failure`),
      failColor: 'white',
    });
    throw error;
  }
}

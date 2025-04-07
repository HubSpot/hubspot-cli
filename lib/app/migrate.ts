import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import {
  confirmPrompt,
  inputPrompt,
  listPrompt,
  promptUser,
} from '../prompts/promptUtils';
import { ApiErrorContext, logError } from '../errorHandlers';
import { EXIT_CODES } from '../enums/exitCodes';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  uiAccountDescription,
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
  migrateApp as migrateNonProjectApp_v2023_2,
  beginMigration,
  finishMigration,
  listAppsForMigration,
} from '@hubspot/local-dev-lib/api/projects';
import { poll } from '../polling';
import path from 'path';
import { getCwd, sanitizeFileName } from '@hubspot/local-dev-lib/path';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { extractZipArchive } from '@hubspot/local-dev-lib/archive';
import { ArgumentsCamelCase } from 'yargs';
import { MigrateAppOptions } from '../../types/Yargs';
import chalk from 'chalk';
import { validateUid } from '@hubspot/project-parsing-lib';
import { MigrationApp } from '@hubspot/local-dev-lib/types/Project';
import { UNMIGRATABLE_REASONS } from '@hubspot/local-dev-lib/constants/projects';
import { mapToUserFacingType } from '@hubspot/project-parsing-lib/src/lib/transform';

function getUnmigratableReason(reasonCode: string): string {
  switch (reasonCode) {
    case UNMIGRATABLE_REASONS.UP_TO_DATE:
      return i18n(
        'commands.project.subcommands.migrateApp.unmigratableReasons.upToDate'
      );
    case UNMIGRATABLE_REASONS.IS_A_PRIVATE_APP:
      return i18n(
        'commands.project.subcommands.migrateApp.unmigratableReasons.isPrivateApp'
      );
    case UNMIGRATABLE_REASONS.LISTED_IN_MARKETPLACE:
      return i18n(
        'commands.project.subcommands.migrateApp.unmigratableReasons.listedInMarketplace'
      );
    default:
      return i18n(
        'commands.project.subcommands.migrateApp.unmigratableReasons.generic',
        {
          reasonCode,
        }
      );
  }
}

async function handleMigrationSetup(
  derivedAccountId: number,
  options: ArgumentsCamelCase<MigrateAppOptions>
): Promise<{
  appIdToMigrate?: number | undefined;
  projectName?: string;
  projectDest?: string;
}> {
  const { name, dest, appId } = options;
  const { data } = await listAppsForMigration(derivedAccountId);

  const { migratableApps, unmigratableApps } = data;
  const allApps = [...migratableApps, ...unmigratableApps];

  if (allApps.length === 0) {
    throw new Error(
      i18n(`commands.project.subcommands.migrateApp.errors.noApps`, {
        accountId: derivedAccountId,
      })
    );
  }

  if (migratableApps.length === 0) {
    const reasons = unmigratableApps.map(
      app =>
        `${chalk.bold(app.appName)}: ${getUnmigratableReason(app.unmigratableReason)}`
    );

    throw new Error(
      `${i18n(`commands.project.subcommands.migrateApp.errors.noAppsEligible`, {
        accountId: derivedAccountId,
      })} \n  - ${reasons.join('\n  - ')}`
    );
  }

  if (
    appId &&
    !allApps.some(app => {
      return app.appId === appId;
    })
  ) {
    throw new Error(
      i18n('commands.project.subcommands.migrateApp.prompt.chooseApp', {
        appId,
      })
    );
  }

  const appChoices = allApps.map(app => ({
    name: app.isMigratable
      ? app.appName
      : `[${chalk.yellow('DISABLED')}] ${app.appName} `,
    value: app,
    disabled: app.isMigratable
      ? false
      : getUnmigratableReason(app.unmigratableReason),
  }));

  let appIdToMigrate = appId;
  if (!appIdToMigrate) {
    const { appId: selectedAppId } = await listPrompt<MigrationApp>(
      i18n('commands.project.subcommands.migrateApp.prompt.chooseApp'),
      {
        choices: appChoices,
      }
    );
    appIdToMigrate = selectedAppId;
  }

  const selectedApp = allApps.find(app => app.appId === appIdToMigrate);

  const migratableComponents: string[] = [];
  const unmigratableComponents: string[] = [];

  selectedApp?.migrationComponents.forEach(component => {
    if (component.isSupported) {
      migratableComponents.push(mapToUserFacingType(component.componentType));
    } else {
      unmigratableComponents.push(mapToUserFacingType(component.componentType));
    }
  });

  if (migratableComponents.length !== 0) {
    logger.log(
      i18n('commands.project.subcommands.migrateApp.componentsToBeMigrated', {
        components: `\n - ${migratableComponents.join('\n - ')}`,
      })
    );
  }

  if (unmigratableComponents.length !== 0) {
    logger.log(
      i18n(
        'commands.project.subcommands.migrateApp.componentsThatWillNotBeMigrated',
        {
          components: `\n - ${unmigratableComponents.join('\n - ')}`,
        }
      )
    );
  }

  logger.log();
  const proceed = await confirmPrompt(
    i18n('commands.project.subcommands.migrateApp.prompt.proceed')
  );

  if (!proceed) {
    return {};
  }

  const projectName =
    name ||
    (await inputPrompt(
      i18n('commands.project.subcommands.migrateApp.prompt.inputName')
    ));

  const { projectExists } = await ensureProjectExists(
    derivedAccountId,
    projectName,
    { forceCreate: false, allowCreate: false, noLogs: true }
  );

  if (projectExists) {
    throw new Error(
      i18n(
        'commands.project.subcommands.migrateApp.errors.projectAlreadyExists',
        {
          projectName,
        }
      )
    );
  }

  const projectDest =
    dest ||
    (await inputPrompt(
      i18n('commands.project.subcommands.migrateApp.prompt.inputDest'),
      {
        defaultAnswer: path.resolve(getCwd(), sanitizeFileName(projectName)),
      }
    ));

  return { appIdToMigrate, projectName, projectDest };
}

async function handleMigrationProcess(
  derivedAccountId: number,
  appId: number
): Promise<{
  migrationId: number;
  uidMap: Record<string, string>;
}> {
  SpinniesManager.add('beginningMigration', {
    text: i18n(
      'commands.project.subcommands.migrateApp.spinners.beginningMigration'
    ),
  });

  const uidMap: Record<string, string> = {};
  let migrationId: number;

  try {
    const { data } = await beginMigration(derivedAccountId, appId);
    const { migrationId: mid, componentsRequiringUids } = data;

    migrationId = mid;
    SpinniesManager.succeed('beginningMigration', {
      text: i18n(
        'commands.project.subcommands.migrateApp.spinners.migrationStarted'
      ),
    });

    if (Object.values(componentsRequiringUids).length !== 0) {
      for (const [componentId, component] of Object.entries(
        componentsRequiringUids
      )) {
        uidMap[componentId] = await inputPrompt(
          i18n(
            'commands.project.subcommands.migrateApp.prompt.uidForComponent',
            {
              componentName: component.componentHint || component.componentType,
            }
          ),
          {
            validate: (uid: string) => {
              const result = validateUid(uid);
              return result === undefined ? true : result;
            },
          }
        );
      }
    }
  } catch (e) {
    SpinniesManager.fail('beginningMigration', {
      text: i18n(
        'commands.project.subcommands.migrateApp.spinners.unableToStartMigration'
      ),
    });
    throw e;
  }

  return { migrationId, uidMap };
}

async function pollMigrationStatus(
  derivedAccountId: number,
  migrationId: number,
  platformVersion: string
) {
  const pollResponse = await poll(() =>
    checkMigrationStatus(derivedAccountId, migrationId, platformVersion)
  );

  const { status } = pollResponse;
  return status === 'SUCCESS';
}

async function finalizeMigration(
  derivedAccountId: number,
  migrationId: number,
  uidMap: Record<string, string>,
  projectName: string,
  platformVersion: string
): Promise<number | undefined> {
  let buildId: number;
  try {
    SpinniesManager.add('finishingMigration', {
      text: i18n(
        `commands.project.subcommands.migrateApp.spinners.finishingMigration`
      ),
    });
    const { data } = await finishMigration(
      derivedAccountId,
      migrationId,
      uidMap,
      projectName,
      platformVersion
    );

    buildId = data.buildId;

    const success = await pollMigrationStatus(
      derivedAccountId,
      migrationId,
      platformVersion
    );

    if (success) {
      SpinniesManager.succeed('finishingMigration', {
        text: i18n(
          `commands.project.subcommands.migrateApp.spinners.migrationComplete`
        ),
      });
    } else {
      SpinniesManager.fail('finishingMigration', {
        text: i18n(
          `commands.project.subcommands.migrateApp.spinners.migrationFailed`
        ),
      });
    }
    return buildId;
  } catch (error) {
    SpinniesManager.fail('finishingMigration', {
      text: i18n(
        `commands.project.subcommands.migrateApp.spinners.migrationFailed`
      ),
    });
    throw error;
  }
}

export async function downloadProjectFiles(
  derivedAccountId: number,
  projectName: string,
  buildId: number,
  projectDest: string
): Promise<void> {
  try {
    SpinniesManager.add('fetchingMigratedProject', {
      text: i18n(
        `commands.project.subcommands.migrateApp.spinners.downloadingProjectContents`
      ),
    });

    const { data: zippedProject } = await downloadProject(
      derivedAccountId,
      projectName,
      buildId
    );

    const absoluteDestPath = projectDest
      ? path.resolve(getCwd(), projectDest)
      : getCwd();

    await extractZipArchive(
      zippedProject,
      sanitizeFileName(projectName),
      path.resolve(absoluteDestPath),
      { includesRootDir: false, hideLogs: false }
    );

    SpinniesManager.succeed('fetchingMigratedProject', {
      text: i18n(
        `commands.project.subcommands.migrateApp.spinners.downloadingProjectContentsComplete`
      ),
    });

    logger.success(`Saved ${projectName} to ${projectDest}`);
  } catch (error) {
    SpinniesManager.fail('fetchingMigratedProject', {
      text: i18n(
        `commands.project.subcommands.migrateApp.spinners.downloadingProjectContentsFailed`
      ),
    });
    throw error;
  }
}

export async function migrateApp2025_2(
  derivedAccountId: number,
  options: ArgumentsCamelCase<MigrateAppOptions>
): Promise<void> {
  SpinniesManager.init();

  const { appIdToMigrate, projectName, projectDest } =
    await handleMigrationSetup(derivedAccountId, options);

  if (!appIdToMigrate || !projectName || !projectDest) {
    return;
  }

  const { migrationId, uidMap } = await handleMigrationProcess(
    derivedAccountId,
    appIdToMigrate
  );

  const buildId = await finalizeMigration(
    derivedAccountId,
    migrationId,
    uidMap,
    projectName,
    options.platformVersion
  );

  if (!buildId) {
    throw new Error('Migration Failed');
  }

  await downloadProjectFiles(
    derivedAccountId,
    projectName,
    buildId,
    projectDest
  );
}

export function logInvalidAccountError(i18nKey: string): void {
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
  derivedAccountId: number,
  options: ArgumentsCamelCase<MigrateAppOptions>,
  accountConfig: CLIAccount
): Promise<void> {
  const i18nKey = 'commands.project.subcommands.migrateApp';
  const accountName = uiAccountDescription(derivedAccountId);

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

  await trackCommandMetadataUsage('migrate-app', undefined, derivedAccountId);

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

    const { data: migrateResponse } = await migrateNonProjectApp_v2023_2(
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

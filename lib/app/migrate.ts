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
  migrateNonProjectApp_v2023_2,
  beginMigration,
  finishMigration,
  listAppsForMigration,
  MigrationApp,
  UNMIGRATABLE_REASONS,
} from '@hubspot/local-dev-lib/api/projects';
import { poll } from '../polling';
import path from 'path';
import { getCwd, sanitizeFileName } from '@hubspot/local-dev-lib/path';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { extractZipArchive } from '@hubspot/local-dev-lib/archive';
import { ArgumentsCamelCase } from 'yargs';
import { MigrateAppOptions } from '../../types/Yargs';
import chalk from 'chalk';

function getUnmigratableReason(reasonCode: string) {
  switch (reasonCode) {
    case UNMIGRATABLE_REASONS.UP_TO_DATE:
      return i18n(
        'commands.project.subcommands.migrateApp.migrationNotAllowedReasons.upToDate'
      );
    case UNMIGRATABLE_REASONS.IS_A_PRIVATE_APP:
      return i18n(
        'commands.project.subcommands.migrateApp.migrationNotAllowedReasons.isPrivateApp'
      );
    case UNMIGRATABLE_REASONS.LISTED_IN_MARKETPLACE:
      return i18n(
        'commands.project.subcommands.migrateApp.migrationNotAllowedReasons.listedInMarketplace'
      );
    default:
      return i18n(
        'commands.project.subcommands.migrateApp.migrationNotAllowedReasons.generic',
        {
          reasonCode,
        }
      );
  }
}

async function handleMigrationSetup(
  derivedAccountId: number,
  options: ArgumentsCamelCase<MigrateAppOptions>
) {
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

    logger.error(
      `${i18n(`commands.project.subcommands.migrateApp.errors.noAppsEligible`, {
        accountId: derivedAccountId,
      })} \n  - ${reasons.join('\n  - ')}`
    );

    return process.exit(EXIT_CODES.SUCCESS);
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

  const appToMigrate = appId
    ? { appId }
    : await listPrompt<MigrationApp>(
        i18n('commands.project.subcommands.migrateApp.prompt.chooseApp'),
        {
          choices: appChoices,
        }
      );

  const projectName =
    name ||
    (await inputPrompt(
      i18n('commands.project.subcommands.migrateApp.prompt.inputName')
    ));

  const { projectExists } = await ensureProjectExists(
    derivedAccountId,
    projectName,
    { forceCreate: false, allowCreate: false }
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
      i18n('commands.project.subcommands.migrateApp.prompt.inputDest')
    ));

  return { appToMigrate, projectName, projectDest };
}

async function handleMigrationProcess(appToMigrate: { appId: number }) {
  SpinniesManager.add('beginningMigration', {
    text: i18n(
      'commands.project.subcommands.migrateApp.spinners.beginningMigration'
    ),
  });

  const uidMap: Record<string, string> = {};
  let migrationId: number | undefined;

  try {
    const { migrationId: mid, uidsRequired } = await beginMigration(
      appToMigrate.appId
    );

    migrationId = mid;
    SpinniesManager.succeed('beginningMigration', {
      text: i18n(
        'commands.project.subcommands.migrateApp.spinners.migrationStarted'
      ),
    });

    if (uidsRequired.length !== 0) {
      for (const u of uidsRequired) {
        uidMap[u] = await inputPrompt(
          i18n(
            'commands.project.subcommands.migrateApp.prompt.uidForComponent',
            { componentName: u }
          )
        );
      }
    }
  } catch (e) {
    SpinniesManager.fail('beginningMigration', {
      text: i18n(
        'commands.project.subcommands.migrateApp.spinners.unableToStartMigration'
      ),
    });
    logError(e);
    return process.exit(EXIT_CODES.ERROR);
  }

  return { migrationId, uidMap };
}

export async function migrateApp2025_2(
  derivedAccountId: number,
  options: ArgumentsCamelCase<MigrateAppOptions>
) {
  SpinniesManager.init();

  const { appToMigrate, projectName, projectDest } = await handleMigrationSetup(
    derivedAccountId,
    options
  );

  const { migrationId, uidMap } = await handleMigrationProcess(appToMigrate);

  let buildId: number;

  try {
    SpinniesManager.add('finishingMigration', {
      text: i18n(
        `commands.project.subcommands.migrateApp.spinners.finishingMigration`
      ),
    });
    const migration = await finishMigration(
      derivedAccountId,
      migrationId,
      uidMap,
      projectName
    );
    buildId = migration.buildId;
    SpinniesManager.succeed('finishingMigration', {
      text: i18n(
        `commands.project.subcommands.migrateApp.spinners.migrationComplete`
      ),
    });
  } catch (error) {
    SpinniesManager.fail('finishingMigration', {
      text: i18n(
        `commands.project.subcommands.migrateApp.spinners.migrationFailed`
      ),
    });
    logError(error);
    process.exit(EXIT_CODES.ERROR);
  }

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
      { includesRootDir: false }
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
    logError(error);
    return process.exit(EXIT_CODES.ERROR);
  }

  process.exit(EXIT_CODES.SUCCESS);
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
  derivedAccountId: number,
  options: ArgumentsCamelCase<MigrateAppOptions>,
  accountConfig: CLIAccount
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

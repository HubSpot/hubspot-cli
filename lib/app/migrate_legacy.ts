import { fetchPublicAppMetadata } from '@hubspot/local-dev-lib/api/appsDev';
import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  checkMigrationStatus,
  downloadProject,
  migrateApp as migrateNonProjectApp_v2023_2,
} from '@hubspot/local-dev-lib/api/projects';
import path from 'path';
import { getCwd, sanitizeFileName } from '@hubspot/local-dev-lib/path';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { extractZipArchive } from '@hubspot/local-dev-lib/archive';
import { ArgumentsCamelCase } from 'yargs';
import { promptUser } from '../prompts/promptUtils';
import { ApiErrorContext, logError } from '../errorHandlers';
import { EXIT_CODES } from '../enums/exitCodes';
import { uiAccountDescription, uiLine, uiLink } from '../ui';
import { i18n } from '../lang';
import { isAppDeveloperAccount } from '../accountTypes';
import { selectPublicAppPrompt } from '../prompts/selectPublicAppPrompt';
import { createProjectPrompt } from '../prompts/createProjectPrompt';
import { ensureProjectExists } from '../projects';
import { trackCommandMetadataUsage } from '../usageTracking';
import SpinniesManager from '../ui/SpinniesManager';
import { handleKeypress } from '../process';
import { poll } from '../polling';
import { logInvalidAccountError, MigrateAppArgs } from './migrate';

export async function migrateApp2023_2(
  derivedAccountId: number,
  options: ArgumentsCamelCase<MigrateAppArgs>,
  accountConfig: CLIAccount
): Promise<void> {
  const accountName = uiAccountDescription(derivedAccountId);

  if (!isAppDeveloperAccount(accountConfig)) {
    logInvalidAccountError();
    process.exit(EXIT_CODES.SUCCESS);
  }

  let appId = options.appId;

  if (!appId) {
    const { appId: selectAppId } = await selectPublicAppPrompt({
      accountId: derivedAccountId,
      accountName,
      isMigratingApp: true,
    });
    appId = selectAppId;
  }

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
      logger.error(
        i18n(`commands.project.subcommands.migrateApp.errors.invalidApp`, {
          appId,
        })
      );
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
      i18n(
        `commands.project.subcommands.migrateApp.errors.projectAlreadyExists`,
        {
          projectName,
        }
      )
    );
  }

  await trackCommandMetadataUsage(
    'migrate-app',
    { step: 'STARTED' },
    derivedAccountId
  );

  logger.log('');
  uiLine();
  logger.warn(
    `${i18n(`commands.project.subcommands.migrateApp.warning.title`)}\n`
  );
  logger.log(
    i18n(`commands.project.subcommands.migrateApp.warning.projectConversion`)
  );
  logger.log(
    `${i18n(`commands.project.subcommands.migrateApp.warning.appConfig`)}\n`
  );
  logger.log(
    `${i18n(`commands.project.subcommands.migrateApp.warning.buildAndDeploy`)}\n`
  );
  logger.log(
    `${i18n(`commands.project.subcommands.migrateApp.warning.existingApps`)}\n`
  );
  logger.log(i18n(`commands.project.subcommands.migrateApp.warning.copyApp`));
  uiLine();

  const { shouldCreateApp } = await promptUser({
    name: 'shouldCreateApp',
    type: 'confirm',
    message: i18n(`commands.project.subcommands.migrateApp.createAppPrompt`),
  });
  process.stdin.resume();

  if (!shouldCreateApp) {
    process.exit(EXIT_CODES.SUCCESS);
  }

  try {
    SpinniesManager.init();

    SpinniesManager.add('migrateApp', {
      text: i18n(
        `commands.project.subcommands.migrateApp.migrationStatus.inProgress`
      ),
    });

    handleKeypress(async key => {
      if ((key.ctrl && key.name === 'c') || key.name === 'q') {
        SpinniesManager.remove('migrateApp');
        logger.log(
          i18n(`commands.project.subcommands.migrateApp.migrationInterrupted`)
        );
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
        text: i18n(
          `commands.project.subcommands.migrateApp.migrationStatus.done`
        ),
        succeedColor: 'white',
      });
      logger.log('');
      uiLine();
      logger.success(
        i18n(`commands.project.subcommands.migrateApp.migrationStatus.success`)
      );
      logger.log('');
      logger.log(
        uiLink(
          i18n(`commands.project.subcommands.migrateApp.projectDetailsLink`),
          `${baseUrl}/developer-projects/${derivedAccountId}/project/${encodeURIComponent(
            project!.name
          )}`
        )
      );
      process.exit(EXIT_CODES.SUCCESS);
    }
  } catch (error) {
    SpinniesManager.fail('migrateApp', {
      text: i18n(
        `commands.project.subcommands.migrateApp.migrationStatus.failure`
      ),
      failColor: 'white',
    });
    throw error;
  }
}

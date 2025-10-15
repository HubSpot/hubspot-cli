import { fetchPublicAppMetadata } from '@hubspot/local-dev-lib/api/appsDev';
import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { uiLogger } from '../ui/logger.js';
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
import { promptUser } from '../prompts/promptUtils.js';
import { ApiErrorContext, logError } from '../errorHandlers/index.js';
import { EXIT_CODES } from '../enums/exitCodes.js';
import { uiAccountDescription, uiLine, uiLink } from '../ui/index.js';
import { commands } from '../../lang/en.js';
import { isAppDeveloperAccount, isUnifiedAccount } from '../accountTypes.js';
import { selectPublicAppForMigrationPrompt } from '../prompts/selectPublicAppForMigrationPrompt.js';
import { projectNameAndDestPrompt } from '../prompts/projectNameAndDestPrompt.js';
import { ensureProjectExists } from '../projects/ensureProjectExists.js';
import { trackCommandMetadataUsage } from '../usageTracking.js';
import SpinniesManager from '../ui/SpinniesManager.js';
import { handleKeypress } from '../process.js';
import { poll } from '../polling.js';
import { logInvalidAccountError, MigrateAppArgs } from './migrate.js';

export async function migrateApp2023_2(
  derivedAccountId: number,
  options: ArgumentsCamelCase<MigrateAppArgs>,
  accountConfig: CLIAccount
): Promise<void> {
  const accountName = uiAccountDescription(derivedAccountId);

  const defaultAccountIsUnified = await isUnifiedAccount(accountConfig);

  if (!isAppDeveloperAccount(accountConfig) && !defaultAccountIsUnified) {
    logInvalidAccountError();
    return process.exit(EXIT_CODES.SUCCESS);
  }

  let appId = options.appId;

  if (!appId) {
    const { appId: selectAppId } = await selectPublicAppForMigrationPrompt({
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
      uiLogger.error(commands.project.migrateApp.errors.invalidApp(appId));
      return process.exit(EXIT_CODES.ERROR);
    }
  } catch (error) {
    logError(error, new ApiErrorContext({ accountId: derivedAccountId }));
    return process.exit(EXIT_CODES.ERROR);
  }

  const { name: projectName, dest: projectDest } =
    await projectNameAndDestPrompt(options);

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
      commands.project.migrateApp.errors.projectAlreadyExists(projectName)
    );
  }

  await trackCommandMetadataUsage(
    'migrate-app',
    { step: 'STARTED' },
    derivedAccountId
  );

  uiLogger.log('');
  uiLine();
  uiLogger.warn(commands.project.migrateApp.warning.title);
  uiLogger.log(commands.project.migrateApp.warning.projectConversion);
  uiLogger.log(commands.project.migrateApp.warning.appConfig);
  uiLogger.log(commands.project.migrateApp.warning.buildAndDeploy);
  uiLogger.log(commands.project.migrateApp.warning.existingApps);
  uiLogger.log(commands.project.migrateApp.warning.copyApp);
  uiLine();

  const { shouldCreateApp } = await promptUser({
    name: 'shouldCreateApp',
    type: 'confirm',
    message: commands.project.migrateApp.createAppPrompt,
  });
  process.stdin.resume();

  if (!shouldCreateApp) {
    return process.exit(EXIT_CODES.SUCCESS);
  }

  try {
    SpinniesManager.init();

    SpinniesManager.add('migrateApp', {
      text: commands.project.migrateApp.migrationStatus.inProgress(),
    });

    handleKeypress(async key => {
      if ((key.ctrl && key.name === 'c') || key.name === 'q') {
        SpinniesManager.remove('migrateApp');
        uiLogger.log(commands.project.migrateApp.migrationInterrupted);
        return process.exit(EXIT_CODES.SUCCESS);
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
        text: commands.project.migrateApp.migrationStatus.done(),
        succeedColor: 'white',
      });
      uiLogger.log('');
      uiLine();
      uiLogger.success(commands.project.migrateApp.migrationStatus.success());
      uiLogger.log('');
      uiLogger.log(
        uiLink(
          commands.project.migrateApp.projectDetailsLink,
          `${baseUrl}/developer-projects/${derivedAccountId}/project/${encodeURIComponent(
            project!.name
          )}`
        )
      );
      process.exit(EXIT_CODES.SUCCESS);
    }
  } catch (error) {
    SpinniesManager.fail('migrateApp', {
      text: commands.project.migrateApp.migrationStatus.failure(),
      failColor: 'white',
    });
    throw error;
  }
}

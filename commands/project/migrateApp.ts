import { inputPrompt, promptUser } from '../../lib/prompts/promptUtils';

import path from 'path';

import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../lib/commonOpts';
import {
  trackCommandUsage,
  trackCommandMetadataUsage,
} from '../../lib/usageTracking';
import { createProjectPrompt } from '../../lib/prompts/createProjectPrompt';
import { i18n } from '../../lib/lang';
import { selectPublicAppPrompt } from '../../lib/prompts/selectPublicAppPrompt';
import { poll } from '../../lib/polling';
import {
  uiAccountDescription,
  uiBetaTag,
  uiCommandReference,
  uiLine,
  uiLink,
} from '../../lib/ui';
import SpinniesManager from '../../lib/ui/SpinniesManager';
import { ApiErrorContext, logError } from '../../lib/errorHandlers';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { isAppDeveloperAccount } from '../../lib/accountTypes';
import { ensureProjectExists } from '../../lib/projects';
import { handleKeypress } from '../../lib/process';
import {
  checkMigrationStatus,
  downloadProject,
  migrateApp,
} from '@hubspot/local-dev-lib/api/projects';
import { getCwd, sanitizeFileName } from '@hubspot/local-dev-lib/path';
import { logger } from '@hubspot/local-dev-lib/logger';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { extractZipArchive } from '@hubspot/local-dev-lib/archive';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { fetchPublicAppMetadata } from '@hubspot/local-dev-lib/api/appsDev';
import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { ArgumentsCamelCase, Argv } from 'yargs';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
} from '../../types/Yargs';

const i18nKey = 'commands.project.subcommands.migrateApp';

exports.command = 'migrate-app';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

interface MigrateAppOptions
  extends CommonArgs,
    AccountArgs,
    EnvironmentArgs,
    ConfigArgs {
  name: string;
  dest: string;
  appId: number;
  unified: boolean;
}

exports.handler = async (options: ArgumentsCamelCase<MigrateAppOptions>) => {
  const { derivedAccountId, unified } = options;
  const accountConfig = getAccountConfig(derivedAccountId);
  const accountName = uiAccountDescription(derivedAccountId);

  if (!accountConfig) {
    throw new Error('Account is not configured');
  }

  if (unified) {
    try {
      await migrateToUnifiedApp(derivedAccountId, accountConfig, options);
      process.exit(EXIT_CODES.SUCCESS);
    } catch (error) {
      logError(error);
      process.exit(EXIT_CODES.ERROR);
    }
  }

  trackCommandUsage('migrate-app', {}, derivedAccountId);

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
    uiLine();
    logger.error(i18n(`${i18nKey}.errors.invalidAccountTypeTitle`));
    logger.log(
      i18n(`${i18nKey}.errors.invalidAccountTypeDescription`, {
        useCommand: uiCommandReference('hs accounts use'),
        authCommand: uiCommandReference('hs auth'),
      })
    );
    uiLine();
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

  let projectName;
  let projectDest;
  try {
    const createProjectPromptResponse = await createProjectPrompt(options);

    projectName = createProjectPromptResponse.name;
    projectDest = createProjectPromptResponse.dest;

    const { projectExists } = await ensureProjectExists(
      derivedAccountId,
      projectName,
      {
        allowCreate: false,
        noLogs: true,
      }
    );

    if (projectExists) {
      logger.error(
        i18n(`${i18nKey}.errors.projectAlreadyExists`, {
          projectName,
        })
      );
      process.exit(EXIT_CODES.ERROR);
    }
  } catch (error) {
    logError(error, new ApiErrorContext({ accountId: derivedAccountId }));
    process.exit(EXIT_CODES.ERROR);
  }

  await trackCommandMetadataUsage(
    'migrate-app',
    { status: 'STARTED' },
    derivedAccountId
  );

  logger.log('');
  uiLine();
  logger.warn(i18n(`${i18nKey}.warning.title`));
  logger.log('');
  logger.log(i18n(`${i18nKey}.warning.projectConversion`));
  logger.log(i18n(`${i18nKey}.warning.appConfig`));
  logger.log('');
  logger.log(i18n(`${i18nKey}.warning.buildAndDeploy`));
  logger.log('');
  logger.log(i18n(`${i18nKey}.warning.existingApps`));
  logger.log('');
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
    await trackCommandMetadataUsage(
      'migrate-app',
      { status: 'FAILURE' },
      derivedAccountId
    );
    SpinniesManager.fail('migrateApp', {
      text: i18n(`${i18nKey}.migrationStatus.failure`),
      failColor: 'white',
    });
    if (
      error &&
      typeof error === 'object' &&
      'errors' in error &&
      Array.isArray(error.errors)
    ) {
      error.errors.forEach(err => logError(err));
    } else {
      logError(error, new ApiErrorContext({ accountId: derivedAccountId }));
    }

    process.exit(EXIT_CODES.ERROR);
  }
  await trackCommandMetadataUsage(
    'migrate-app',
    { status: 'SUCCESS' },
    derivedAccountId
  );
  process.exit(EXIT_CODES.SUCCESS);
};

exports.builder = (yargs: Argv) => {
  yargs.options({
    name: {
      describe: i18n(`${i18nKey}.options.name.describe`),
      type: 'string',
    },
    dest: {
      describe: i18n(`${i18nKey}.options.dest.describe`),
      type: 'string',
    },
    'app-id': {
      describe: i18n(`${i18nKey}.options.appId.describe`),
      type: 'number',
    },
    unified: {
      type: 'boolean',
      hidden: true,
      default: false,
    },
  });

  yargs.example([
    ['$0 project migrate-app', i18n(`${i18nKey}.examples.default`)],
  ]);

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  return yargs;
};

export async function migrateToUnifiedApp(
  derivedAccountId: number,
  accountConfig: CLIAccount,
  options: unknown
) {
  console.log('der', derivedAccountId);
  console.log('acc', accountConfig);
  console.log('opt', options);

  // Check if the command is running within a project
  const isProject = false;
  let appId: number;

  if (isProject) {
    // Use the current project and app details for the migration
    appId = 111;
  } else {
    // Make the call to get the list of the non project apps eligible to migrate
    // Prompt the user to select the app to migrate
    // Prompt the user for a project name and destination
    const projectName = await inputPrompt(
      'Enter the name of the app you want to migrate: '
    );
    console.log(projectName);
    const projectDest = await inputPrompt(
      'Where do you want to save the project?: '
    );
    console.log(projectDest);
    appId = 999;
  }

  // Call the migration end points
  const { migrationId, uidsRequired } = await beginMigration(appId);

  const uidMap: Record<string, string> = {};

  if (uidsRequired.length !== 0) {
    for (const u of uidsRequired) {
      uidMap[u] = await inputPrompt(`Give me a uid for ${u}: `);
    }
  }

  try {
    const response = await finishMigration(migrationId, uidMap);
    // Poll using the projectId and the build id?
    console.log(response);
  } catch (error) {
    logError(error);
    process.exit(EXIT_CODES.ERROR);
  }
}

interface MigrationStageOneResponse {
  migrationId: number;
  uidsRequired: string[];
}
export async function beginMigration(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  appId: number
): Promise<MigrationStageOneResponse> {
  console.log(`migrating ${appId}`);
  return new Promise(async resolve => {
    setTimeout(() => {
      resolve({
        migrationId: 1234,
        uidsRequired: ['App 1', 'App 2'],
      });
    }, 150);
  });
}

type MigrationFinishResponse = {
  projectId: number;
  buildId: number;
};

export async function finishMigration(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  migrationId: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  uidMap: Record<string, string>
): Promise<MigrationFinishResponse> {
  return new Promise(async resolve => {
    setTimeout(() => {
      resolve({
        projectId: 1234,
        buildId: 5555,
      });
    }, 150);
  });
}

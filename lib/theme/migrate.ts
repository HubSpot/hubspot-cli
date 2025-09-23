import path from 'path';
import { ArgumentsCamelCase } from 'yargs';
import {
  migrateThemes,
  getProjectThemeDetails,
} from '@hubspot/project-parsing-lib';
import { LoadedProjectConfig, writeProjectConfig } from '../projects/config.js';
import { ensureProjectExists } from '../projects/ensureProjectExists.js';
import SpinniesManager from '../ui/SpinniesManager.js';
import { lib } from '../../lang/en.js';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
} from '../../types/Yargs.js';
import { PROJECT_CONFIG_FILE } from '../constants.js';
import { uiLogger } from '../ui/logger.js';
import { debugError } from '../errorHandlers/index.js';
import { isV2Project } from '../projects/platformVersion.js';
import { confirmPrompt } from '../prompts/promptUtils.js';
import { fetchMigrationApps } from '../app/migrate.js';

export type MigrateThemesArgs = CommonArgs &
  AccountArgs &
  EnvironmentArgs &
  ConfigArgs & {
    platformVersion: string;
  };

export async function getHasMigratableThemes(
  projectConfig?: LoadedProjectConfig
): Promise<{ hasMigratableThemes: boolean; migratableThemesCount: number }> {
  if (!projectConfig?.projectConfig?.name || !projectConfig?.projectDir) {
    return { hasMigratableThemes: false, migratableThemesCount: 0 };
  }

  const projectSrcDir = path.resolve(
    projectConfig.projectDir!,
    projectConfig.projectConfig.srcDir
  );

  const { legacyThemeDetails, legacyReactThemeDetails } =
    await getProjectThemeDetails(projectSrcDir);

  return {
    hasMigratableThemes:
      legacyThemeDetails.length > 0 || legacyReactThemeDetails.length > 0,
    migratableThemesCount:
      legacyThemeDetails.length + legacyReactThemeDetails.length,
  };
}

export async function validateMigrationAppsAndThemes(
  hasApps: number,
  projectConfig?: LoadedProjectConfig
) {
  if (isV2Project(projectConfig?.projectConfig?.platformVersion)) {
    throw new Error(lib.migrate.errors.project.themesAlreadyMigrated);
  }
  if (hasApps > 0 && projectConfig) {
    throw new Error(lib.migrate.errors.project.themesAndAppsNotAllowed);
  }
  if (!projectConfig) {
    throw new Error(lib.migrate.errors.project.noProjectForThemesMigration);
  }
}

export async function handleThemesMigration(
  projectConfig: LoadedProjectConfig,
  platformVersion: string
): Promise<void> {
  if (!projectConfig?.projectDir || !projectConfig?.projectConfig?.srcDir) {
    throw new Error(lib.migrate.errors.project.invalidConfig);
  }

  const projectSrcDir = path.resolve(
    projectConfig.projectDir,
    projectConfig.projectConfig.srcDir
  );

  let migrated = false;
  let failureReason: string | undefined;
  try {
    const migrationResult = await migrateThemes(
      projectConfig.projectDir,
      projectSrcDir
    );

    migrated = migrationResult.migrated;
    failureReason = migrationResult.failureReason;
  } catch (error) {
    debugError(error);
    throw new Error(lib.migrate.errors.project.failedToMigrateThemes);
  }

  if (!migrated) {
    throw new Error(
      failureReason || lib.migrate.errors.project.failedToMigrateThemes
    );
  }

  const newProjectConfig = { ...projectConfig.projectConfig };
  newProjectConfig.platformVersion = platformVersion;

  const projectConfigPath = path.join(
    projectConfig.projectDir,
    PROJECT_CONFIG_FILE
  );

  const success = writeProjectConfig(projectConfigPath, newProjectConfig);

  if (!success) {
    throw new Error(lib.migrate.errors.project.failedToUpdateProjectConfig);
  }

  uiLogger.log('');
  uiLogger.log(lib.migrate.success.themesMigrationSuccess(platformVersion));
}

export async function migrateThemes2025_2(
  derivedAccountId: number,
  options: ArgumentsCamelCase<MigrateThemesArgs>,
  themeCount: number,
  projectConfig: LoadedProjectConfig
): Promise<void> {
  SpinniesManager.init();

  if (!projectConfig?.projectConfig || !projectConfig?.projectDir) {
    throw new Error(lib.migrate.errors.project.invalidConfig);
  }
  const { projectExists } = await ensureProjectExists(
    derivedAccountId,
    projectConfig.projectConfig.name,
    { allowCreate: false, noLogs: true }
  );

  if (!projectExists) {
    throw new Error(lib.migrate.errors.project.doesNotExist(derivedAccountId));
  }

  SpinniesManager.add('checkingForMigratableComponents', {
    text: lib.migrate.spinners.checkingForMigratableComponents,
  });

  const { migratableApps, unmigratableApps } = await fetchMigrationApps(
    derivedAccountId,
    options.platformVersion,
    projectConfig
  );
  const hasApps = [...migratableApps, ...unmigratableApps].length;

  SpinniesManager.remove('checkingForMigratableComponents');

  await validateMigrationAppsAndThemes(hasApps, projectConfig);

  uiLogger.log(lib.migrate.prompt.themesMigration(themeCount));

  const proceed = await confirmPrompt(lib.migrate.prompt.proceed, {
    defaultAnswer: false,
  });

  if (proceed) {
    await handleThemesMigration(projectConfig!, options.platformVersion);
  } else {
    uiLogger.log(lib.migrate.exitWithoutMigrating);
  }
}

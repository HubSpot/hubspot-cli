import { logger } from '@hubspot/local-dev-lib/logger';
import path from 'path';
import { getCwd, sanitizeFileName } from '@hubspot/local-dev-lib/path';
import { extractZipArchive } from '@hubspot/local-dev-lib/archive';
import { ArgumentsCamelCase } from 'yargs';
import chalk from 'chalk';
import { validateUid } from '@hubspot/project-parsing-lib';
import { UNMIGRATABLE_REASONS } from '@hubspot/local-dev-lib/constants/projects';
import { mapToUserFacingType } from '@hubspot/project-parsing-lib/src/lib/transform';
import { MIGRATION_STATUS } from '@hubspot/local-dev-lib/types/Migration';
import { downloadProject } from '@hubspot/local-dev-lib/api/projects';
import { confirmPrompt, inputPrompt, listPrompt } from '../prompts/promptUtils';
import { uiAccountDescription, uiCommandReference, uiLine } from '../ui';
import { ensureProjectExists, LoadedProjectConfig } from '../projects';
import SpinniesManager from '../ui/SpinniesManager';
import { DEFAULT_POLLING_STATUS_LOOKUP, poll } from '../polling';
import {
  checkMigrationStatusV2,
  continueMigration,
  initializeMigration,
  isMigrationStatus,
  listAppsForMigration,
  MigrationApp,
  MigrationStatus,
} from '../../api/migrate';
import fs from 'fs';
import { lib } from '../../lang/en';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
} from '../../types/Yargs';
import { hasFeature } from '../hasFeature';

export type MigrateAppArgs = CommonArgs &
  AccountArgs &
  EnvironmentArgs &
  ConfigArgs & {
    name?: string;
    dest?: string;
    appId?: number;
    platformVersion: string;
  };

function getUnmigratableReason(reasonCode: string): string {
  switch (reasonCode) {
    case UNMIGRATABLE_REASONS.UP_TO_DATE:
      return lib.migrate.errors.unmigratableReasons.upToDate;
    case UNMIGRATABLE_REASONS.IS_A_PRIVATE_APP:
      return lib.migrate.errors.unmigratableReasons.isPrivateApp;
    case UNMIGRATABLE_REASONS.LISTED_IN_MARKETPLACE:
      return lib.migrate.errors.unmigratableReasons.listedInMarketplace;
    default:
      return lib.migrate.errors.unmigratableReasons.generic(reasonCode);
  }
}

function filterAppsByProjectName(
  projectConfig?: LoadedProjectConfig
): (app: MigrationApp) => boolean {
  return (app: MigrationApp) => {
    if (projectConfig) {
      return app.projectName === projectConfig?.projectConfig?.name;
    }
    return !app.projectName;
  };
}

async function fetchMigrationApps(
  appId: MigrateAppArgs['appId'],
  derivedAccountId: number,
  platformVersion: string,
  projectConfig?: LoadedProjectConfig
): Promise<MigrationApp[]> {
  const {
    data: { migratableApps, unmigratableApps },
  } = await listAppsForMigration(derivedAccountId, platformVersion);

  const filteredMigratableApps = migratableApps.filter(
    filterAppsByProjectName(projectConfig)
  );

  const filteredUnmigratableApps = unmigratableApps.filter(
    filterAppsByProjectName(projectConfig)
  );

  const allApps = [...filteredMigratableApps, ...filteredUnmigratableApps];

  if (allApps.length > 1 && projectConfig) {
    throw new Error(lib.migrate.errors.project.multipleApps);
  }

  if (allApps.length === 0 && projectConfig) {
    throw new Error(
      lib.migrate.errors.noAppsForProject(
        projectConfig?.projectConfig?.name || ''
      )
    );
  }

  if (
    allApps.length === 0 ||
    filteredUnmigratableApps.length === allApps.length
  ) {
    const reasons = filteredUnmigratableApps.map(
      app =>
        `${chalk.bold(app.appName)}: ${getUnmigratableReason(app.unmigratableReason)}`
    );

    throw new Error(
      lib.migrate.errors.noAppsEligible(
        uiAccountDescription(derivedAccountId),
        reasons
      )
    );
  }

  if (
    appId &&
    !allApps.some(app => {
      return app.appId === appId;
    })
  ) {
    throw new Error(lib.migrate.errors.appWithAppIdNotFound(appId));
  }

  return allApps;
}

async function selectAppToMigrate(
  allApps: MigrationApp[],
  appId?: number,
  projectConfig?: LoadedProjectConfig
): Promise<{ proceed: boolean; appIdToMigrate?: number }> {
  if (
    appId &&
    !allApps.some(app => {
      return app.appId === appId;
    })
  ) {
    throw new Error(lib.migrate.errors.appWithAppIdNotFound(appId));
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
      lib.migrate.prompt.chooseApp,
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
      lib.migrate.componentsToBeMigrated(
        `\n - ${[...new Set(migratableComponents)].join('\n - ')}`
      )
    );
  }

  if (unmigratableComponents.length !== 0) {
    logger.log(
      lib.migrate.componentsThatWillNotBeMigrated(
        `\n - ${[...new Set(unmigratableComponents)].join('\n - ')}`
      )
    );
  }

  logger.log();

  if (projectConfig?.projectConfig) {
    logger.log(lib.migrate.projectMigrationWarning);
  }

  const promptMessage = projectConfig?.projectConfig
    ? `${lib.migrate.projectMigrationWarning} ${lib.migrate.prompt.proceed}`
    : lib.migrate.prompt.proceed;

  const proceed = await confirmPrompt(promptMessage);
  return {
    proceed,
    appIdToMigrate,
  };
}

async function handleMigrationSetup(
  derivedAccountId: number,
  options: ArgumentsCamelCase<MigrateAppArgs>,
  projectConfig?: LoadedProjectConfig
): Promise<{
  appIdToMigrate?: number | undefined;
  projectName?: string;
  projectDest?: string;
}> {
  const { name, dest, appId } = options;

  const allApps = await fetchMigrationApps(
    appId,
    derivedAccountId,
    options.platformVersion,
    projectConfig
  );

  const { proceed, appIdToMigrate } = await selectAppToMigrate(
    allApps,
    appId,
    projectConfig
  );

  if (!proceed) {
    return {};
  }

  // If it's a project we don't want to prompt for dest and name, so just return early
  if (
    projectConfig &&
    projectConfig?.projectConfig &&
    projectConfig?.projectDir
  ) {
    return {
      appIdToMigrate,
      projectName: projectConfig.projectConfig.name,
      projectDest: projectConfig.projectDir,
    };
  }

  const projectName =
    name ||
    (await inputPrompt(lib.migrate.prompt.inputName, {
      validate: async (input: string) => {
        const { projectExists } = await ensureProjectExists(
          derivedAccountId,
          input,
          { allowCreate: false, noLogs: true }
        );

        if (projectExists) {
          return lib.migrate.errors.project.alreadyExists(input);
        }

        return true;
      },
    }));

  const { projectExists } = await ensureProjectExists(
    derivedAccountId,
    projectName,
    { allowCreate: false, noLogs: true }
  );

  if (projectExists) {
    throw new Error(lib.migrate.errors.project.alreadyExists(projectName));
  }

  const projectDest =
    dest ||
    (await inputPrompt(lib.migrate.prompt.inputDest, {
      defaultAnswer: path.resolve(getCwd(), sanitizeFileName(projectName)),
    }));

  return { appIdToMigrate, projectName, projectDest };
}

async function beginMigration(
  derivedAccountId: number,
  appId: number,
  platformVersion: string
): Promise<
  | {
      migrationId: number;
      uidMap: Record<string, string>;
    }
  | undefined
> {
  SpinniesManager.add('beginningMigration', {
    text: lib.migrate.spinners.beginningMigration,
  });

  const uidMap: Record<string, string> = {};

  const { data } = await initializeMigration(
    derivedAccountId,
    appId,
    platformVersion
  );
  const { migrationId } = data;

  const pollResponse = await pollMigrationStatus(
    derivedAccountId,
    migrationId,
    [MIGRATION_STATUS.INPUT_REQUIRED]
  );

  if (pollResponse.status !== MIGRATION_STATUS.INPUT_REQUIRED) {
    SpinniesManager.fail('beginningMigration', {
      text: lib.migrate.spinners.unableToStartMigration,
    });
    return;
  }

  const { componentsRequiringUids } = pollResponse;

  SpinniesManager.remove('beginningMigration');

  if (Object.values(componentsRequiringUids).length !== 0) {
    for (const [componentId, component] of Object.entries(
      componentsRequiringUids
    )) {
      const { componentHint, componentType } = component;
      uidMap[componentId] = await inputPrompt(
        lib.migrate.prompt.uidForComponent(
          componentHint
            ? `${mapToUserFacingType(componentType)} '${componentHint}'`
            : mapToUserFacingType(componentType)
        ),
        {
          validate: (uid: string) => {
            const result = validateUid(uid);
            return result === undefined ? true : result;
          },
          defaultAnswer: (componentHint || '')
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, ''),
        }
      );
    }
  }

  return { migrationId, uidMap };
}

async function pollMigrationStatus(
  derivedAccountId: number,
  migrationId: number,
  successStates: string[] = []
): Promise<MigrationStatus> {
  return poll(() => checkMigrationStatusV2(derivedAccountId, migrationId), {
    successStates: [...successStates],
    errorStates: [...DEFAULT_POLLING_STATUS_LOOKUP.errorStates],
  });
}

async function finalizeMigration(
  derivedAccountId: number,
  migrationId: number,
  uidMap: Record<string, string>,
  projectName: string
): Promise<number> {
  let pollResponse: MigrationStatus;
  try {
    SpinniesManager.add('finishingMigration', {
      text: lib.migrate.spinners.finishingMigration,
    });
    await continueMigration(derivedAccountId, migrationId, uidMap, projectName);

    pollResponse = await pollMigrationStatus(derivedAccountId, migrationId, [
      MIGRATION_STATUS.SUCCESS,
    ]);
  } catch (error) {
    SpinniesManager.fail('finishingMigration', {
      text: lib.migrate.spinners.migrationFailed,
    });

    if (isMigrationStatus(error) && error.status === MIGRATION_STATUS.FAILURE) {
      throw new Error(error.projectErrorDetail);
    }

    throw new Error(lib.migrate.errors.migrationFailed, {
      cause: error,
    });
  }

  if (pollResponse.status !== MIGRATION_STATUS.SUCCESS) {
    throw new Error(lib.migrate.errors.migrationFailed);
  }

  if (pollResponse.status === MIGRATION_STATUS.SUCCESS) {
    SpinniesManager.succeed('finishingMigration', {
      text: lib.migrate.spinners.migrationComplete,
    });
  }

  return pollResponse.buildId;
}

async function downloadProjectFiles(
  derivedAccountId: number,
  projectName: string,
  buildId: number,
  projectDest: string,
  projectConfig?: LoadedProjectConfig
): Promise<void> {
  try {
    SpinniesManager.add('fetchingMigratedProject', {
      text: lib.migrate.spinners.downloadingProjectContents,
    });

    const { data: zippedProject } = await downloadProject(
      derivedAccountId,
      projectName,
      buildId
    );

    let absoluteDestPath;

    if (projectConfig?.projectConfig && projectConfig?.projectDir) {
      const { projectDir } = projectConfig;
      absoluteDestPath = projectDir;
      const { srcDir } = projectConfig.projectConfig;

      const archiveDest = path.join(projectDir, 'archive');

      // Move the existing source directory to archive
      fs.renameSync(path.join(projectDir, srcDir), archiveDest);

      logger.info(lib.migrate.sourceContentsMoved(archiveDest));
    } else {
      absoluteDestPath = projectDest
        ? path.resolve(getCwd(), projectDest)
        : getCwd();
    }

    await extractZipArchive(
      zippedProject,
      sanitizeFileName(projectName),
      absoluteDestPath,
      {
        includesRootDir: true,
        hideLogs: true,
      }
    );

    SpinniesManager.succeed('fetchingMigratedProject', {
      text: lib.migrate.spinners.downloadingProjectContentsComplete,
    });

    logger.success(`Saved ${projectName} to ${projectDest}`);
  } catch (error) {
    SpinniesManager.fail('fetchingMigratedProject', {
      text: lib.migrate.spinners.downloadingProjectContentsFailed,
    });
    throw error;
  }
}

export async function migrateApp2025_2(
  derivedAccountId: number,
  options: ArgumentsCamelCase<MigrateAppArgs>,
  projectConfig?: LoadedProjectConfig
): Promise<void> {
  SpinniesManager.init();

  const ungatedForUnifiedApps = await hasFeature(
    derivedAccountId,
    'Developers:UnifiedApps:PrivateBeta'
  );

  if (!ungatedForUnifiedApps) {
    throw new Error(
      lib.migrate.errors.notUngatedForUnifiedApps(
        uiAccountDescription(derivedAccountId)
      )
    );
  }

  if (projectConfig) {
    if (!projectConfig?.projectConfig || !projectConfig?.projectDir) {
      throw new Error(lib.migrate.errors.project.invalidConfig);
    }
    const { projectExists } = await ensureProjectExists(
      derivedAccountId,
      projectConfig.projectConfig.name,
      { allowCreate: false, noLogs: true }
    );

    if (!projectExists) {
      throw new Error(lib.migrate.errors.project.doesNotExist);
    }
  }

  const { appIdToMigrate, projectName, projectDest } =
    await handleMigrationSetup(derivedAccountId, options, projectConfig);

  if (!appIdToMigrate || !projectName || !projectDest) {
    return;
  }

  const migrationInProgress = await beginMigration(
    derivedAccountId,
    appIdToMigrate,
    options.platformVersion
  );

  if (!migrationInProgress) {
    return;
  }

  const { migrationId, uidMap } = migrationInProgress;
  const buildId = await finalizeMigration(
    derivedAccountId,
    migrationId,
    uidMap,
    projectConfig?.projectConfig?.name || projectName
  );

  await downloadProjectFiles(
    derivedAccountId,
    projectName,
    buildId,
    projectDest,
    projectConfig
  );
}

export function logInvalidAccountError(): void {
  uiLine();
  logger.error(lib.migrate.errors.invalidAccountTypeTitle);
  logger.log(
    lib.migrate.errors.invalidAccountTypeDescription(
      uiCommandReference('hs account use'),
      uiCommandReference('hs auth')
    )
  );
  uiLine();
}

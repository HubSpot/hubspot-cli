import path from 'path';
import { getCwd, sanitizeFileName } from '@hubspot/local-dev-lib/path';
import { extractZipArchive } from '@hubspot/local-dev-lib/archive';
import { ArgumentsCamelCase } from 'yargs';
import chalk from 'chalk';
import { validateUid } from '@hubspot/project-parsing-lib';
import { UNMIGRATABLE_REASONS } from '@hubspot/local-dev-lib/constants/projects';
import { mapToUserFacingType } from '@hubspot/project-parsing-lib/src/lib/transform.js';
import { MIGRATION_STATUS } from '@hubspot/local-dev-lib/types/Migration';
import { downloadProject } from '@hubspot/local-dev-lib/api/projects';
import { Separator } from '@inquirer/prompts';
import {
  confirmPrompt,
  inputPrompt,
  listPrompt,
} from '../prompts/promptUtils.js';
import {
  uiAccountDescription,
  uiCommandReference,
  uiLine,
  uiLink,
} from '../ui/index.js';
import { LoadedProjectConfig } from '../projects/config.js';
import { ensureProjectExists } from '../projects/ensureProjectExists.js';
import SpinniesManager from '../ui/SpinniesManager.js';
import { DEFAULT_POLLING_STATUS_LOOKUP, poll } from '../polling.js';
import {
  checkMigrationStatusV2,
  CLI_UNMIGRATABLE_REASONS,
  continueAppMigration,
  initializeAppMigration,
  isMigrationStatus,
  listAppsForMigration,
  MigrationApp,
  MigratableApp,
  UnmigratableApp,
  MigrationFailed,
  MigrationStatus,
} from '../../api/migrate.js';
import fs from 'fs';
import { lib } from '../../lang/en.js';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
} from '../../types/Yargs.js';
import { hasUnfiedAppsAccess } from '../hasFeature.js';
import {
  getProjectBuildDetailUrl,
  getProjectDetailUrl,
} from '../projects/urls.js';
import { uiLogger } from '../ui/logger.js';

export type MigrateAppArgs = CommonArgs &
  AccountArgs &
  EnvironmentArgs &
  ConfigArgs & {
    name?: string;
    dest?: string;
    appId?: number;
    platformVersion: string;
    unstable: boolean;
  };

export function getUnmigratableReason(
  reasonCode: string,
  projectName: string | undefined,
  accountId: number
): string {
  switch (reasonCode) {
    case UNMIGRATABLE_REASONS.UP_TO_DATE:
      return lib.migrate.errors.unmigratableReasons.upToDate;
    case UNMIGRATABLE_REASONS.IS_A_PRIVATE_APP:
      return lib.migrate.errors.unmigratableReasons.isPrivateApp;
    case UNMIGRATABLE_REASONS.LISTED_IN_MARKETPLACE:
      return lib.migrate.errors.unmigratableReasons.listedInMarketplace;
    case UNMIGRATABLE_REASONS.PROJECT_CONNECTED_TO_GITHUB:
      return lib.migrate.errors.unmigratableReasons.projectConnectedToGitHub(
        projectName,
        accountId
      );
    case CLI_UNMIGRATABLE_REASONS.PART_OF_PROJECT_ALREADY:
      return lib.migrate.errors.unmigratableReasons.partOfProjectAlready;
    default:
      return lib.migrate.errors.unmigratableReasons.generic(reasonCode);
  }
}

export function generateFilterAppsByProjectNameFunction(
  projectConfig?: LoadedProjectConfig
): (app: MigrationApp) => boolean {
  return (app: MigrationApp) => {
    if (projectConfig) {
      return app.projectName === projectConfig?.projectConfig?.name;
    }
    return true;
  };
}

export function buildErrorMessageFromMigrationStatus(
  error: MigrationFailed
): string {
  const { componentErrors, projectErrorDetail } = error;
  if (!componentErrors || !componentErrors.length) {
    return projectErrorDetail;
  }
  return `${projectErrorDetail}: \n\t- ${componentErrors
    .map(componentError => {
      const {
        componentType,
        errorMessage,
        developerSymbol: uid,
      } = componentError;

      return `${componentType}${uid ? ` (${uid})` : ''}: ${errorMessage}`;
    })
    .join('\n\t- ')}`;
}

export async function fetchMigrationApps(
  derivedAccountId: number,
  platformVersion: string,
  projectConfig?: LoadedProjectConfig
): Promise<{
  migratableApps: MigratableApp[];
  unmigratableApps: UnmigratableApp[];
}> {
  const {
    data: { migratableApps, unmigratableApps },
  } = await listAppsForMigration(derivedAccountId, platformVersion);

  const filteredMigratableApps = migratableApps.filter(
    generateFilterAppsByProjectNameFunction(projectConfig)
  );

  const filteredUnmigratableApps = unmigratableApps.filter(
    generateFilterAppsByProjectNameFunction(projectConfig)
  );

  return {
    migratableApps: filteredMigratableApps,
    unmigratableApps: filteredUnmigratableApps,
  };
}

export async function validateMigrationApps(
  appId: MigrateAppArgs['appId'],
  derivedAccountId: number,
  {
    migratableApps,
    unmigratableApps,
  }: { migratableApps: MigratableApp[]; unmigratableApps: UnmigratableApp[] },
  projectConfig?: LoadedProjectConfig
) {
  const allApps = [...migratableApps, ...unmigratableApps];

  if (allApps.length > 1 && projectConfig) {
    throw new Error(lib.migrate.errors.project.multipleApps);
  }

  if (!projectConfig?.projectConfig) {
    allApps.forEach(app => {
      if (app.projectName) {
        app.isMigratable = false;
        app.unmigratableReason =
          CLI_UNMIGRATABLE_REASONS.PART_OF_PROJECT_ALREADY;
      }
    });
  }

  if (allApps.length === 0 && projectConfig) {
    throw new Error(
      lib.migrate.errors.noAppsForProject(
        projectConfig?.projectConfig?.name || ''
      )
    );
  }

  if (allApps.length === 0 || !allApps.some(app => app.isMigratable)) {
    const reasons = unmigratableApps.map(
      app =>
        `${chalk.bold(app.appName)}: ${getUnmigratableReason(app.unmigratableReason, app.projectName, derivedAccountId)}`
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
}

export async function promptForAppToMigrate(
  allApps: MigrationApp[],
  derivedAccountId: number
) {
  const appChoices = allApps.map(app => ({
    name: app.isMigratable
      ? app.appName
      : `[${chalk.yellow('DISABLED')}] ${app.appName} `,
    value: app,
    disabled: app.isMigratable
      ? false
      : getUnmigratableReason(
          app.unmigratableReason,
          app.projectName,
          derivedAccountId
        ),
  }));

  const enabledChoices = appChoices.filter(app => !app.disabled);
  const disabledChoices = appChoices.filter(app => app.disabled);

  const { appId: selectedAppId } = await listPrompt<MigrationApp>(
    lib.migrate.prompt.chooseApp,
    {
      choices: [...enabledChoices, new Separator(), ...disabledChoices],
    }
  );

  return selectedAppId;
}
export async function selectAppToMigrate(
  allApps: MigrationApp[],
  derivedAccountId: number,
  appId?: number
): Promise<{ proceed: boolean; appIdToMigrate?: number }> {
  if (
    appId &&
    !allApps.some(app => {
      return app.appId === appId;
    })
  ) {
    throw new Error(lib.migrate.errors.appWithAppIdNotFound(appId));
  }

  let appIdToMigrate = appId;
  if (!appIdToMigrate) {
    appIdToMigrate = await promptForAppToMigrate(allApps, derivedAccountId);
  }

  const selectedApp = allApps.find(app => app.appId === appIdToMigrate);

  const migratableComponents: Set<string> = new Set();
  const unmigratableComponents: Set<string> = new Set();

  selectedApp?.migrationComponents.forEach(component => {
    if (component.isSupported) {
      migratableComponents.add(mapToUserFacingType(component.componentType));
    } else {
      unmigratableComponents.add(mapToUserFacingType(component.componentType));
    }
  });

  if (migratableComponents.size !== 0) {
    uiLogger.log(
      lib.migrate.componentsToBeMigrated(
        `\n - ${[...migratableComponents].join('\n - ')}`
      )
    );
  }

  if (unmigratableComponents.size !== 0) {
    uiLogger.log(
      lib.migrate.componentsThatWillNotBeMigrated(
        `\n - ${[...unmigratableComponents].join('\n - ')}`
      )
    );
  }

  uiLogger.log('');

  const proceed = await confirmPrompt(lib.migrate.prompt.proceed, {
    defaultAnswer: false,
  });
  return {
    proceed,
    appIdToMigrate,
  };
}

export async function handleMigrationSetup(
  derivedAccountId: number,
  options: ArgumentsCamelCase<MigrateAppArgs>,
  projectConfig?: LoadedProjectConfig
): Promise<{
  appIdToMigrate?: number | undefined;
  projectName?: string;
  projectDest?: string;
}> {
  SpinniesManager.add('checkingForMigratableComponents', {
    text: lib.migrate.spinners.checkingForMigratableComponents,
  });
  const { name, dest, appId } = options;

  const { migratableApps, unmigratableApps } = await fetchMigrationApps(
    derivedAccountId,
    options.platformVersion,
    projectConfig
  );

  SpinniesManager.remove('checkingForMigratableComponents');

  await validateMigrationApps(
    appId,
    derivedAccountId,
    { migratableApps, unmigratableApps },
    projectConfig
  );

  const allApps = [...migratableApps, ...unmigratableApps];

  const { proceed, appIdToMigrate } = await selectAppToMigrate(
    allApps,
    derivedAccountId,
    appId
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

export async function beginAppMigration(
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

  const { data } = await initializeAppMigration(
    derivedAccountId,
    appId,
    platformVersion
  );
  const { migrationId } = data;

  let pollResponse: MigrationStatus;
  try {
    pollResponse = await pollMigrationStatus(derivedAccountId, migrationId, [
      MIGRATION_STATUS.INPUT_REQUIRED,
    ]);
  } catch (error) {
    SpinniesManager.fail('beginningMigration', {
      text: lib.migrate.spinners.unableToStartMigration,
    });
    if (isMigrationStatus(error) && error.status === MIGRATION_STATUS.FAILURE) {
      throw new Error(buildErrorMessageFromMigrationStatus(error));
    }
    throw new Error(lib.migrate.errors.migrationFailed, {
      cause: error,
    });
  }

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

      // Extract the internal ID from the base64-encoded ComponentExternalId
      let internalId: string;
      try {
        const decoded = Buffer.from(componentId, 'base64').toString('utf8');
        const parts = decoded.split('$$');
        internalId = parts[1] || componentId;
      } catch {
        // If decoding fails, use the componentId as the internalId
        internalId = componentId;
      }

      const promptText = componentHint
        ? `${mapToUserFacingType(componentType)} '${componentHint}' (ID: ${internalId})`
        : `${mapToUserFacingType(componentType)} (ID: ${internalId})`;

      uidMap[componentId] = await inputPrompt(
        lib.migrate.prompt.uidForComponent(promptText),
        {
          validate: (uid: string) => {
            const result = validateUid(uid);
            return result === undefined ? true : result;
          },
          defaultAnswer: componentHint
            ? componentHint.replace(/[^A-Za-z0-9_\-.]/g, '')
            : undefined,
        }
      );
    }
  }

  return { migrationId, uidMap };
}

export async function pollMigrationStatus(
  derivedAccountId: number,
  migrationId: number,
  successStates: string[] = []
): Promise<MigrationStatus> {
  return poll(() => checkMigrationStatusV2(derivedAccountId, migrationId), {
    successStates: [...successStates],
    errorStates: [...DEFAULT_POLLING_STATUS_LOOKUP.errorStates],
  });
}

export async function finalizeAppMigration(
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
    await continueAppMigration(
      derivedAccountId,
      migrationId,
      uidMap,
      projectName
    );

    pollResponse = await pollMigrationStatus(derivedAccountId, migrationId, [
      MIGRATION_STATUS.SUCCESS,
    ]);
  } catch (error) {
    SpinniesManager.fail('finishingMigration', {
      text: lib.migrate.spinners.migrationFailed,
    });

    if (isMigrationStatus(error) && error.status === MIGRATION_STATUS.FAILURE) {
      throw new Error(buildErrorMessageFromMigrationStatus(error));
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

export async function downloadProjectFiles(
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

      uiLogger.info(lib.migrate.sourceContentsMoved(archiveDest));
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

    uiLogger.success(
      lib.migrate.success.downloadedProject(projectName, projectDest)
    );
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

  const ungatedForUnifiedApps = await hasUnfiedAppsAccess(derivedAccountId);

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
      throw new Error(
        lib.migrate.errors.project.doesNotExist(derivedAccountId)
      );
    }
  }

  const { appIdToMigrate, projectName, projectDest } =
    await handleMigrationSetup(derivedAccountId, options, projectConfig);

  if (!appIdToMigrate || !projectName || !projectDest) {
    return;
  }

  const migrationInProgress = await beginAppMigration(
    derivedAccountId,
    appIdToMigrate,
    options.platformVersion
  );

  if (!migrationInProgress) {
    return;
  }

  const { migrationId, uidMap } = migrationInProgress;
  const buildId = await finalizeAppMigration(
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

  uiLogger.log(
    uiLink(
      'Project Details',
      getProjectDetailUrl(projectName, derivedAccountId)!
    )
  );

  uiLogger.log(
    uiLink(
      'Build Details',
      getProjectBuildDetailUrl(projectName, buildId, derivedAccountId)!
    )
  );
}

export function logInvalidAccountError(): void {
  uiLine();
  uiLogger.error(lib.migrate.errors.invalidAccountTypeTitle);
  uiLogger.log(
    lib.migrate.errors.invalidAccountTypeDescription(
      uiCommandReference('hs account use')
    )
  );
  uiLine();
}

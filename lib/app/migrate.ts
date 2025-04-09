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
import { uiCommandReference, uiLine } from '../ui';
import { i18n } from '../lang';
import { ensureProjectExists } from '../projects';
import SpinniesManager from '../ui/SpinniesManager';
import { DEFAULT_POLLING_STATUS_LOOKUP, poll } from '../polling';
import { MigrateAppOptions } from '../../types/Yargs';
import {
  checkMigrationStatusV2,
  continueMigration,
  initializeMigration,
  listAppsForMigration,
  MigrationApp,
  MigrationStatus,
} from '../../api/migrate';

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

  const allApps = [...migratableApps, ...unmigratableApps].filter(
    app => !app.projectName
  );

  if (allApps.length === 0) {
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
    { allowCreate: false, noLogs: true }
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
    text: i18n(
      'commands.project.subcommands.migrateApp.spinners.beginningMigration'
    ),
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
      text: i18n(
        'commands.project.subcommands.migrateApp.spinners.unableToStartMigration'
      ),
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
        i18n('commands.project.subcommands.migrateApp.prompt.uidForComponent', {
          componentName: componentHint
            ? `${componentHint} [${componentType}]`
            : componentType,
        }),
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
      text: i18n(
        `commands.project.subcommands.migrateApp.spinners.finishingMigration`
      ),
    });
    await continueMigration(derivedAccountId, migrationId, uidMap, projectName);

    pollResponse = await pollMigrationStatus(derivedAccountId, migrationId, [
      MIGRATION_STATUS.SUCCESS,
    ]);
  } catch (error) {
    SpinniesManager.fail('finishingMigration', {
      text: i18n(
        `commands.project.subcommands.migrateApp.spinners.migrationFailed`
      ),
    });
    throw error;
  }

  if (pollResponse.status === MIGRATION_STATUS.SUCCESS) {
    SpinniesManager.succeed('finishingMigration', {
      text: i18n(
        `commands.project.subcommands.migrateApp.spinners.migrationComplete`
      ),
    });

    return pollResponse.buildId;
  } else {
    SpinniesManager.fail('finishingMigration', {
      text: i18n(
        `commands.project.subcommands.migrateApp.spinners.migrationFailed`
      ),
    });
    if (pollResponse.status === MIGRATION_STATUS.FAILURE) {
      logger.error(pollResponse.componentErrorDetails);
      throw new Error(pollResponse.projectErrorsDetail);
    }

    throw new Error(
      i18n('commands.project.subcommands.migrateApp.errors.migrationFailed')
    );
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
      absoluteDestPath,
      {
        includesRootDir: true,
        hideLogs: false,
      }
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
    projectName
  );

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

import { HubSpotPromise } from '@hubspot/local-dev-lib/types/Http';
import {
  PLATFORM_VERSIONS,
  UNMIGRATABLE_REASONS,
} from '@hubspot/local-dev-lib/constants/projects';
import { http } from '@hubspot/local-dev-lib/http';
import { MIGRATION_STATUS } from '@hubspot/local-dev-lib/types/Migration';

const MIGRATIONS_API_PATH_V2 = 'dfs/migrations/v2';

interface BaseMigrationApp {
  appId: number;
  appName: string;
  isMigratable: boolean;
  migrationComponents: ListAppsMigrationComponent[];
  projectName?: string;
}

export interface MigratableApp extends BaseMigrationApp {
  isMigratable: true;
  unmigratableReason?: undefined;
}

export const CLI_UNMIGRATABLE_REASONS = {
  PART_OF_PROJECT_ALREADY: 'PART_OF_PROJECT_ALREADY',
} as const;

export interface UnmigratableApp extends BaseMigrationApp {
  isMigratable: false;
  unmigratableReason:
    | keyof typeof UNMIGRATABLE_REASONS
    | keyof typeof CLI_UNMIGRATABLE_REASONS;
}

export type MigrationApp = MigratableApp | UnmigratableApp;

export interface ListAppsResponse {
  migratableApps: MigratableApp[];
  unmigratableApps: UnmigratableApp[];
}

export interface InitializeMigrationResponse {
  migrationId: number;
}

export interface ListAppsMigrationComponent {
  id: string;
  componentType: string;
  isSupported: boolean;
}

export type ContinueMigrationResponse = {
  migrationId: number;
};

export interface MigrationBaseStatus {
  id: number;
}

export interface MigrationInProgress extends MigrationBaseStatus {
  status: typeof MIGRATION_STATUS.IN_PROGRESS;
}

export interface MigrationInputRequired extends MigrationBaseStatus {
  status: typeof MIGRATION_STATUS.INPUT_REQUIRED;
  componentsRequiringUids: Record<
    string,
    {
      componentType: string;
      componentHint: string;
    }
  >;
}

export interface MigrationSuccess extends MigrationBaseStatus {
  status: typeof MIGRATION_STATUS.SUCCESS;
  buildId: number;
}

interface ComponentError {
  componentType: string;
  developerSymbol?: string;
  errorMessage: string;
}

export interface MigrationFailed extends MigrationBaseStatus {
  status: typeof MIGRATION_STATUS.FAILURE;
  projectErrorDetail: string;
  componentErrors: ComponentError[];
}

export type MigrationStatus =
  | MigrationInProgress
  | MigrationInputRequired
  | MigrationSuccess
  | MigrationFailed;

export function isMigrationStatus(error: unknown): error is MigrationStatus {
  return (
    typeof error === 'object' &&
    error !== null &&
    'id' in error &&
    'status' in error
  );
}

export async function listAppsForMigration(
  accountId: number,
  platformVersion: string
): HubSpotPromise<ListAppsResponse> {
  return http.get<ListAppsResponse>(accountId, {
    url: `${MIGRATIONS_API_PATH_V2}/list-apps`,
    params: {
      platformVersion: mapPlatformVersionToEnum(platformVersion),
    },
  });
}

function mapPlatformVersionToEnum(platformVersion: string): string {
  if (platformVersion === PLATFORM_VERSIONS.unstable) {
    return PLATFORM_VERSIONS.unstable.toUpperCase();
  }

  return `V${platformVersion.replace('.', '_')}`;
}

export async function initializeMigration(
  accountId: number,
  applicationId: number,
  platformVersion: string
): HubSpotPromise<InitializeMigrationResponse> {
  return http.post(accountId, {
    url: `${MIGRATIONS_API_PATH_V2}/migrations`,
    data: {
      applicationId,
      platformVersion: mapPlatformVersionToEnum(platformVersion),
    },
  });
}

export async function continueMigration(
  portalId: number,
  migrationId: number,
  componentUids: Record<string, string>,
  projectName: string
): HubSpotPromise<ContinueMigrationResponse> {
  return http.post(portalId, {
    url: `${MIGRATIONS_API_PATH_V2}/migrations/continue`,
    data: {
      migrationId,
      projectName,
      componentUids,
    },
  });
}

export async function checkMigrationStatusV2(
  accountId: number,
  id: number
): HubSpotPromise<MigrationStatus> {
  return http.get<MigrationStatus>(accountId, {
    url: `${MIGRATIONS_API_PATH_V2}/migrations/${id}/status`,
  });
}

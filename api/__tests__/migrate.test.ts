import { http } from '@hubspot/local-dev-lib/http';
import { MIGRATION_STATUS } from '@hubspot/local-dev-lib/types/Migration';
import {
  listAppsForMigration,
  initializeAppMigration,
  continueAppMigration,
  checkMigrationStatusV2,
  ListAppsResponse,
  MigrationStatus,
  isMigrationStatus,
} from '../migrate.js';
import { Mocked } from 'vitest';

vi.mock('@hubspot/local-dev-lib/http');

const httpMock = http as Mocked<typeof http>;

describe('api/migrate', () => {
  const mockAccountId = 12345;
  const mockPortalId = 12345;
  const mockAppId = 67890;
  const mockMigrationId = 54321;
  const mockPlatformVersion = '2025.2';
  const convertedPlatformVersion = 'V2025_2';
  const mockProjectName = 'Test Project';
  const mockComponentUids = { 'component-1': 'uid-1', 'component-2': 'uid-2' };

  describe('listAppsForMigration', () => {
    it('should call http.get with correct parameters', async () => {
      const mockResponse: ListAppsResponse = {
        migratableApps: [
          {
            appId: 1,
            appName: 'App 1',
            isMigratable: true,
            migrationComponents: [
              { id: 'comp1', componentType: 'type1', isSupported: true },
            ],
          },
        ],
        unmigratableApps: [
          {
            appId: 2,
            appName: 'App 2',
            isMigratable: false,
            unmigratableReason: 'UP_TO_DATE',
            migrationComponents: [
              { id: 'comp2', componentType: 'type2', isSupported: false },
            ],
          },
        ],
      };

      // @ts-expect-error Mock
      httpMock.get.mockResolvedValue(mockResponse);

      const result = await listAppsForMigration(
        mockAccountId,
        mockPlatformVersion
      );

      expect(http.get).toHaveBeenCalledWith(mockAccountId, {
        url: 'dfs/migrations/v2/list-apps',
        params: {
          platformVersion: convertedPlatformVersion,
        },
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('initializeAppMigration', () => {
    it('should call http.post with correct parameters', async () => {
      const mockResponse = { migrationId: mockMigrationId };
      // @ts-expect-error Mock
      httpMock.post.mockResolvedValue(mockResponse);

      const result = await initializeAppMigration(
        mockAccountId,
        mockAppId,
        mockPlatformVersion
      );

      expect(http.post).toHaveBeenCalledWith(mockAccountId, {
        url: 'dfs/migrations/v2/migrations',
        data: {
          applicationId: mockAppId,
          platformVersion: convertedPlatformVersion,
        },
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('continueAppMigration', () => {
    it('should call http.post with correct parameters', async () => {
      const mockResponse = { migrationId: mockMigrationId };
      // @ts-expect-error Mock
      httpMock.post.mockResolvedValue(mockResponse);

      const result = await continueAppMigration(
        mockPortalId,
        mockMigrationId,
        mockComponentUids,
        mockProjectName
      );

      expect(http.post).toHaveBeenCalledWith(mockPortalId, {
        url: 'dfs/migrations/v2/migrations/continue',
        data: {
          migrationId: mockMigrationId,
          projectName: mockProjectName,
          componentUids: mockComponentUids,
        },
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('checkMigrationStatusV2', () => {
    it('should call http.get with correct parameters for in-progress status', async () => {
      const mockResponse: MigrationStatus = {
        id: mockMigrationId,
        status: MIGRATION_STATUS.IN_PROGRESS,
      };
      // @ts-expect-error Mock
      httpMock.get.mockResolvedValue(mockResponse);

      const result = await checkMigrationStatusV2(
        mockAccountId,
        mockMigrationId
      );

      expect(http.get).toHaveBeenCalledWith(mockAccountId, {
        url: `dfs/migrations/v2/migrations/${mockMigrationId}/status`,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle input required status', async () => {
      const mockResponse: MigrationStatus = {
        id: mockMigrationId,
        status: MIGRATION_STATUS.INPUT_REQUIRED,
        componentsRequiringUids: {
          'component-1': {
            componentType: 'type1',
            componentHint: 'hint1',
          },
        },
      };
      // @ts-expect-error Mock
      httpMock.get.mockResolvedValue(mockResponse);

      const result = await checkMigrationStatusV2(
        mockAccountId,
        mockMigrationId
      );

      expect(result).toEqual(mockResponse);
    });

    it('should handle success status', async () => {
      const mockResponse: MigrationStatus = {
        id: mockMigrationId,
        status: MIGRATION_STATUS.SUCCESS,
        buildId: 98765,
      };
      // @ts-expect-error Mock
      httpMock.get.mockResolvedValue(mockResponse);

      const result = await checkMigrationStatusV2(
        mockAccountId,
        mockMigrationId
      );

      expect(result).toEqual(mockResponse);
    });

    it('should handle failure status', async () => {
      const mockResponse: MigrationStatus = {
        id: mockMigrationId,
        status: MIGRATION_STATUS.FAILURE,
        projectErrorDetail: 'Error details',
        componentErrors: [],
      };
      // @ts-expect-error Mock
      httpMock.get.mockResolvedValue(mockResponse);

      const result = await checkMigrationStatusV2(
        mockAccountId,
        mockMigrationId
      );

      expect(result).toEqual(mockResponse);
    });
  });
});

describe('isMigrationStatus', () => {
  it.each([
    {
      id: 123,
      status: MIGRATION_STATUS.IN_PROGRESS,
    },
    {
      id: 456,
      status: MIGRATION_STATUS.INPUT_REQUIRED,
      componentsRequiringUids: {
        'component-1': {
          componentType: 'type1',
          componentHint: 'hint1',
        },
      },
    },
    {
      id: 789,
      status: MIGRATION_STATUS.SUCCESS,
      buildId: 98765,
    },
    {
      id: 101,
      status: MIGRATION_STATUS.FAILURE,
      projectErrorDetail: 'Error details',
      componentErrors: [],
    },
  ])('should return true for valid MigrationStatus object %j', status => {
    expect(isMigrationStatus(status)).toBe(true);
  });

  it.each([null, undefined, 123, 'string', true, false, []])(
    'should return false for non-object value %j',
    value => {
      expect(isMigrationStatus(value)).toBe(false);
    }
  );

  it.each([
    {},
    { id: 123 },
    { status: MIGRATION_STATUS.IN_PROGRESS },
    { foo: 'bar' },
  ])('should return false for invalid object %j', obj => {
    expect(isMigrationStatus(obj)).toBe(false);
  });
});

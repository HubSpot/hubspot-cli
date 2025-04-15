import { http } from '@hubspot/local-dev-lib/http';
import { MIGRATION_STATUS } from '@hubspot/local-dev-lib/types/Migration';
import {
  listAppsForMigration,
  initializeMigration,
  continueMigration,
  checkMigrationStatusV2,
  ListAppsResponse,
  MigrationStatus,
} from '../migrate';

jest.mock('@hubspot/local-dev-lib/http');

const httpMock = http as jest.Mocked<typeof http>;

describe('api/migrate', () => {
  const mockAccountId = 12345;
  const mockPortalId = 12345;
  const mockAppId = 67890;
  const mockMigrationId = 54321;
  const mockPlatformVersion = '2025.2';
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
          platformVersion: mockPlatformVersion,
        },
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('initializeMigration', () => {
    it('should call http.post with correct parameters', async () => {
      const mockResponse = { migrationId: mockMigrationId };
      // @ts-expect-error Mock
      httpMock.post.mockResolvedValue(mockResponse);

      const result = await initializeMigration(
        mockAccountId,
        mockAppId,
        mockPlatformVersion
      );

      expect(http.post).toHaveBeenCalledWith(mockAccountId, {
        url: 'dfs/migrations/v2/migrations',
        data: {
          applicationId: mockAppId,
          platformVersion: 'V2025_2',
        },
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('continueMigration', () => {
    it('should call http.post with correct parameters', async () => {
      const mockResponse = { migrationId: mockMigrationId };
      // @ts-expect-error Mock
      httpMock.post.mockResolvedValue(mockResponse);

      const result = await continueMigration(
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
        componentErrorDetails: {
          'component-1': 'Component error',
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
  });
});

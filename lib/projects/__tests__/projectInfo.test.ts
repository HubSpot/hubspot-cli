import { fetchAppMetadataBySourceId } from '@hubspot/local-dev-lib/api/appsDev';
import { Project } from '@hubspot/local-dev-lib/types/Project';
import { getProjectInfo } from '../projectInfo.js';
import { getProjectDetailUrl } from '../urls.js';

vi.mock('@hubspot/local-dev-lib/api/appsDev');
vi.mock('../urls');
vi.mock('../../errorHandlers/index.js');

const mockedFetchAppMetadataBySourceId = vi.mocked(fetchAppMetadataBySourceId);
const mockedGetProjectDetailUrl = vi.mocked(getProjectDetailUrl);

const mockProject = {
  id: 42,
  name: 'my-project',
  deployedBuild: {
    buildId: 7,
    isAutoDeployEnabled: true,
    subbuildStatuses: [
      {
        buildName: 'my-app',
        buildType: 'APPLICATION',
      },
      {
        buildName: 'card-one',
        buildType: 'APP_CARD',
      },
      {
        buildName: 'func-one',
        buildType: 'SERVERLESS_FUNCTION',
      },
    ],
  },
} as unknown as Project;

const mockAppMetadata = {
  name: 'My App',
  id: 99,
  authType: 'OAUTH',
  distributionType: 'PRIVATE',
};

describe('lib/projects/projectInfo', () => {
  beforeEach(() => {
    mockedGetProjectDetailUrl.mockReturnValue(
      'https://app.hubspot.com/project/my-project'
    );
    mockedFetchAppMetadataBySourceId.mockResolvedValue({
      data: mockAppMetadata,
    } as unknown as Awaited<ReturnType<typeof fetchAppMetadataBySourceId>>);
  });

  describe('getProjectInfo', () => {
    it('should return project metadata', async () => {
      const result = await getProjectInfo(mockProject, '2025.2', 100);

      expect(result.projectName).toEqual('my-project');
      expect(result.platformVersion).toEqual('2025.2');
      expect(result.projectId).toEqual(42);
      expect(result.deployedBuildId).toEqual(7);
      expect(result.autoDeployEnabled).toEqual(true);
    });

    it('should include projectUrl when available', async () => {
      const result = await getProjectInfo(mockProject, '2025.2', 100);

      expect(result.projectUrl).toEqual(
        'https://app.hubspot.com/project/my-project'
      );
    });

    it('should not include projectUrl when getProjectDetailUrl returns undefined', async () => {
      mockedGetProjectDetailUrl.mockReturnValue(undefined);

      const result = await getProjectInfo(mockProject, '2025.2', 100);

      expect(result.projectUrl).toBeUndefined();
    });

    it('should fetch and include app metadata for APPLICATION subbuild', async () => {
      const result = await getProjectInfo(mockProject, '2025.2', 100);

      expect(mockedFetchAppMetadataBySourceId).toHaveBeenCalledWith(
        42,
        'my-app',
        100
      );
      expect(result.app).toEqual({
        name: 'My App',
        id: 99,
        uid: 'my-app',
        authType: 'OAUTH',
        distributionType: 'PRIVATE',
      });
    });

    it('should gracefully handle app metadata fetch failure', async () => {
      mockedFetchAppMetadataBySourceId.mockRejectedValue(
        new Error('App fetch failed')
      );

      const result = await getProjectInfo(mockProject, '2025.2', 100);

      expect(result.app).toBeUndefined();
    });

    it('should not fetch app metadata when no APPLICATION subbuild exists', async () => {
      const projectWithoutApp = {
        ...mockProject,
        deployedBuild: {
          ...mockProject.deployedBuild!,
          subbuildStatuses: [
            {
              buildName: 'card-one',
              buildType: 'APP_CARD',
              userDefinedId: 'card-one-uid',
            },
          ],
        },
      } as unknown as Project;

      const result = await getProjectInfo(projectWithoutApp, '2025.2', 100);

      expect(mockedFetchAppMetadataBySourceId).not.toHaveBeenCalled();
      expect(result.app).toBeUndefined();
    });

    it('should use buildName as component uid', async () => {
      const result = await getProjectInfo(mockProject, '2025.2', 100);

      const cardComponent = result.components.find(c => c.type === 'APP_CARD');
      expect(cardComponent?.uid).toEqual('card-one');

      const funcComponent = result.components.find(
        c => c.type === 'SERVERLESS_FUNCTION'
      );
      expect(funcComponent?.uid).toEqual('func-one');
    });

    it('should exclude APPLICATION subbuild from components list', async () => {
      const result = await getProjectInfo(mockProject, '2025.2', 100);

      const appComponent = result.components.find(
        c => c.type === 'APPLICATION'
      );
      expect(appComponent).toBeUndefined();
      expect(result.components).toHaveLength(2);
    });
  });
});

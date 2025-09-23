import path from 'path';
import { translateForLocalDev } from '@hubspot/project-parsing-lib';
import { handleProjectUpload } from '../upload.js';
import { handleProjectDeploy } from '../deploy.js';
import { getProjectConfig } from '../config.js';
import { fetchProject } from '@hubspot/local-dev-lib/api/projects';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import LocalDevProcess from '../localDev/LocalDevProcess.js';
import LocalDevLogger from '../localDev/LocalDevLogger.js';
import DevServerManagerV2 from '../localDev/DevServerManagerV2.js';
import { LocalDevStateConstructorOptions } from '../../../types/LocalDev.js';
import { ProjectConfig } from '../../../types/Projects.js';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { Mock, vi, Mocked } from 'vitest';

// Mock @hubspot/ui-extensions-dev-server
vi.mock('@hubspot/ui-extensions-dev-server', () => ({
  DevModeUnifiedInterface: {
    setup: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    fileChange: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('open');
vi.mock('@hubspot/project-parsing-lib');
vi.mock('../upload');
vi.mock('../deploy');
vi.mock('../config');
vi.mock('@hubspot/local-dev-lib/api/projects');
vi.mock('@hubspot/local-dev-lib/errors/index');
vi.mock('../localDev/LocalDevLogger');
vi.mock('../localDev/DevServerManagerV2');

// Tests for LocalDevProcess and LocalDevState
describe('LocalDevProcess', () => {
  let mockLocalDevLogger: Mocked<LocalDevLogger>;
  let mockDevServerManager: Mocked<DevServerManagerV2>;
  let process: LocalDevProcess;

  const mockProjectConfig: ProjectConfig = {
    name: 'test-project',
    srcDir: 'src',
    platformVersion: '1.0.0',
  };

  const mockOptions: LocalDevStateConstructorOptions = {
    projectDir: '/test/project',
    projectConfig: mockProjectConfig,
    targetProjectAccountId: 123,
    targetTestingAccountId: 456,
    projectData: {
      id: 789,
      name: 'test-project',
      portalId: 123,
      createdAt: 0,
      deletedAt: 0,
      isLocked: false,
      updatedAt: 0,
      latestBuild: {
        activitySource: { type: 'HUBSPOT_USER', userId: 456 },
        buildId: 123,
        createdAt: '2023-01-01T00:00:00Z',
        deployableState: 'DEPLOYABLE',
        deployStatusTaskLocator: { id: 'task-123', links: [] },
        enqueuedAt: '2023-01-01T00:00:00Z',
        finishedAt: '2023-01-01T00:05:00Z',
        isAutoDeployEnabled: false,
        portalId: 123,
        projectName: 'test-project',
        startedAt: '2023-01-01T00:01:00Z',
        status: 'SUCCESS',
        subbuildStatuses: [],
        uploadMessage: 'Build completed',
        autoDeployId: 0,
      },
    },
    initialProjectNodes: {},
    initialProjectProfileData: {},
    env: ENVIRONMENTS.PROD,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockLocalDevLogger = {
      resetSpinnies: vi.fn(),
      devServerSetupError: vi.fn(),
      devServerStartError: vi.fn(),
      devServerCleanupError: vi.fn(),
      missingComponentsWarning: vi.fn(),
      startupMessage: vi.fn(),
      monitorConsoleOutput: vi.fn(),
      cleanupStart: vi.fn(),
      cleanupError: vi.fn(),
      cleanupSuccess: vi.fn(),
      uploadInitiated: vi.fn(),
      projectConfigMismatch: vi.fn(),
      uploadError: vi.fn(),
      uploadSuccess: vi.fn(),
      fileChangeError: vi.fn(),
      uploadWarning: vi.fn(),
      deployInitiated: vi.fn(),
      deployError: vi.fn(),
      deploySuccess: vi.fn(),
    } as unknown as Mocked<LocalDevLogger>;

    mockDevServerManager = {
      setup: vi.fn().mockResolvedValue(undefined),
      start: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn().mockResolvedValue(undefined),
      fileChange: vi.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<DevServerManagerV2>;

    // Mock constructors
    (LocalDevLogger as Mock).mockImplementation(() => mockLocalDevLogger);
    (DevServerManagerV2 as Mock).mockImplementation(() => mockDevServerManager);

    // Mock external functions
    (isHubSpotHttpError as unknown as Mock).mockReturnValue(false);

    // Create process instance
    process = new LocalDevProcess(mockOptions);

    // Mock process.exit
    vi.spyOn(global.process, 'exit').mockImplementation(
      (code?: string | number | null) => {
        throw new Error(`Process.exit called with code ${code}`);
      }
    );
  });

  describe('start()', () => {
    it('should exit if dev server setup fails', async () => {
      mockDevServerManager.setup.mockRejectedValue(new Error('Setup failed'));

      await expect(process.start()).rejects.toThrow(
        'Process.exit called with code 1'
      );
      expect(mockLocalDevLogger.devServerSetupError).toHaveBeenCalled();
    });

    it('should start successfully and compare project nodes', async () => {
      await process.start();

      expect(mockLocalDevLogger.startupMessage).toHaveBeenCalled();
      expect(mockDevServerManager.start).toHaveBeenCalled();
      expect(mockLocalDevLogger.monitorConsoleOutput).toHaveBeenCalled();
      expect(
        mockLocalDevLogger.missingComponentsWarning
      ).not.toHaveBeenCalled();
    });
  });

  describe('stop()', () => {
    it('should exit with error if cleanup fails', async () => {
      mockDevServerManager.cleanup.mockRejectedValue(
        new Error('Cleanup failed')
      );

      await expect(process.stop()).rejects.toThrow(
        'Process.exit called with code 1'
      );
      expect(mockLocalDevLogger.cleanupError).toHaveBeenCalled();
    });

    it('should exit successfully after cleanup', async () => {
      await expect(process.stop()).rejects.toThrow(
        'Process.exit called with code 0'
      );
      expect(mockLocalDevLogger.cleanupSuccess).toHaveBeenCalled();
    });

    it('should not show progress messages when showProgress is false', async () => {
      await expect(process.stop(false)).rejects.toThrow(
        'Process.exit called with code 0'
      );
      expect(mockLocalDevLogger.cleanupStart).not.toHaveBeenCalled();
      expect(mockLocalDevLogger.cleanupSuccess).not.toHaveBeenCalled();
    });
  });

  describe('updateProjectNodes()', () => {
    it('should update project nodes with translated representation', async () => {
      const mockNodes = { node1: { uid: 'node1' } };
      (translateForLocalDev as Mock).mockResolvedValue({
        intermediateNodesIndexedByUid: mockNodes,
      });

      // @ts-expect-error testing private method
      await process.updateProjectNodes();

      expect(translateForLocalDev).toHaveBeenCalledWith(
        {
          projectSourceDir: path.join(
            mockOptions.projectDir,
            mockOptions.projectConfig.srcDir
          ),
          platformVersion: mockOptions.projectConfig.platformVersion,
          accountId: mockOptions.targetProjectAccountId,
        },
        { projectNodesAtLastUpload: {} }
      );
      expect(process.projectNodes).toEqual(mockNodes);
    });
  });

  describe('uploadProject()', () => {
    it('should not upload if project config is invalid', async () => {
      (getProjectConfig as Mock).mockResolvedValue({
        projectConfig: null,
      });

      await process.uploadProject();

      expect(mockLocalDevLogger.projectConfigMismatch).toHaveBeenCalled();
      expect(handleProjectUpload).not.toHaveBeenCalled();
    });

    it('should handle upload error', async () => {
      (getProjectConfig as Mock).mockResolvedValue({
        projectConfig: mockOptions.projectConfig,
      });
      (handleProjectUpload as Mock).mockResolvedValue({
        uploadError: new Error('Upload failed'),
      });

      const result = await process.uploadProject();

      expect(mockLocalDevLogger.uploadError).toHaveBeenCalledWith(
        new Error('Upload failed')
      );
      expect(result).toEqual({
        uploadSuccess: false,
        buildSuccess: false,
        deploySuccess: false,
        deployId: undefined,
      });
    });

    it('should handle successful upload', async () => {
      await process.handleConfigFileChange();

      (getProjectConfig as Mock).mockResolvedValue({
        projectConfig: mockOptions.projectConfig,
      });
      (handleProjectUpload as Mock).mockResolvedValue({
        uploadError: null,
        result: {
          deployResult: {
            id: 'deploy-123',
            deployId: 123,
            status: 'SUCCESS',
          },
        },
      });
      (fetchProject as Mock).mockResolvedValue({
        data: {
          id: 789,
          name: 'test-project',
          portalId: 123,
          createdAt: 0,
          deletedAt: 0,
          isLocked: false,
          updatedAt: 0,
          latestBuild: { id: 'build-1', status: 'SUCCESS' },
          deployedBuild: { id: 'build-1', status: 'SUCCESS' },
        },
      });

      const result = await process.uploadProject();

      expect(fetchProject).toHaveBeenCalledWith(
        mockOptions.targetProjectAccountId,
        mockOptions.projectConfig.name
      );
      expect(mockLocalDevLogger.uploadSuccess).toHaveBeenCalled();
      // @ts-expect-error accessing private property for testing
      expect(process.state.uploadWarnings.size).toBe(0);
      expect(result).toEqual({
        uploadSuccess: true,
        buildSuccess: true,
        deploySuccess: true,
        deployId: 123,
      });
    });

    it('should reset projectNodesAtLastUpload if deploy is successful', async () => {
      const mockInitialNodes = {
        node1: {
          uid: 'node1',
          componentType: 'APP',
          localDev: {
            componentRoot: '/test/path',
            componentConfigPath: '/test/path/config.json',
            configUpdatedSinceLastUpload: false,
          },
          componentDeps: {},
          metaFilePath: '/test/path',
          config: { name: 'Node 1' },
          files: [],
        },
      };

      const mockNewNodes = {
        node1: {
          uid: 'node2',
          componentType: 'APP',
          localDev: {
            componentRoot: '/test/path',
            componentConfigPath: '/test/path/config.json',
            configUpdatedSinceLastUpload: false,
          },
          componentDeps: {},
          metaFilePath: '/test/path',
          config: { name: 'Node 2' },
          files: [],
        },
      };
      // @ts-expect-error accessing private property for testing
      process.state.projectNodesAtLastDeploy = mockInitialNodes;

      (getProjectConfig as Mock).mockResolvedValue({
        projectConfig: mockOptions.projectConfig,
      });
      (handleProjectUpload as Mock).mockResolvedValue({
        uploadError: null,
        result: {
          deployResult: {
            id: 'deploy-123',
            deployId: 456,
            status: 'SUCCESS',
          },
        },
      });
      (translateForLocalDev as Mock).mockResolvedValue({
        intermediateNodesIndexedByUid: mockNewNodes,
      });
      (fetchProject as Mock).mockResolvedValue({
        data: {
          id: 789,
          name: 'test-project',
          portalId: 123,
          createdAt: 0,
          deletedAt: 0,
          isLocked: false,
          updatedAt: 0,
          latestBuild: { id: 'build-1', status: 'SUCCESS' },
          deployedBuild: { id: 'build-1', status: 'SUCCESS' },
        },
      });

      const result = await process.uploadProject();

      // Verify translateForLocalDev was called during updateProjectNodesAfterDeploy
      expect(translateForLocalDev).toHaveBeenCalledWith(
        {
          projectSourceDir: path.join(
            mockOptions.projectDir,
            mockOptions.projectConfig.srcDir
          ),
          platformVersion: mockOptions.projectConfig.platformVersion,
          accountId: mockOptions.targetProjectAccountId,
        },
        {
          profile: undefined,
          projectNodesAtLastUpload: undefined,
        }
      );

      // Verify projectNodesAtLastUpload was reset to the new nodes
      // @ts-expect-error accessing private property for testing
      expect(process.state.projectNodesAtLastDeploy).toEqual(mockNewNodes);
      expect(result).toEqual({
        uploadSuccess: true,
        buildSuccess: true,
        deploySuccess: true,
        deployId: 456,
      });
    });
  });

  describe('handleFileChange()', () => {
    it('should handle file change successfully', async () => {
      const filePath = 'test/file.js';
      const event = 'change';

      await process.handleFileChange(filePath, event);

      expect(mockDevServerManager.fileChange).toHaveBeenCalledWith({
        filePath,
        event,
      });
    });

    it('should log error if file change fails', async () => {
      const error = new Error('File change failed');
      mockDevServerManager.fileChange.mockImplementation(() => {
        throw error;
      });

      await process.handleFileChange('test/file.js', 'change');

      expect(mockLocalDevLogger.fileChangeError).toHaveBeenCalledWith(error);
    });
  });

  describe('handleConfigFileChange()', () => {
    beforeEach(() => {
      (translateForLocalDev as Mock).mockResolvedValue({
        intermediateNodesIndexedByUid: {},
      });
    });

    it('should update project nodes and show upload warning', async () => {
      await process.handleConfigFileChange();

      expect(translateForLocalDev).toHaveBeenCalledWith(
        {
          projectSourceDir: path.join(
            mockOptions.projectDir,
            mockOptions.projectConfig.srcDir
          ),
          platformVersion: mockOptions.projectConfig.platformVersion,
          accountId: mockOptions.targetProjectAccountId,
        },
        { projectNodesAtLastUpload: {} }
      );
      expect(mockLocalDevLogger.uploadWarning).toHaveBeenCalled();
    });
  });

  describe('addStateListener()', () => {
    it('should add state listener', () => {
      const listener = vi.fn();
      const key = 'projectNodes';

      process.addStateListener(key, listener);

      // @ts-expect-error
      process.state.projectNodes = {};
      expect(listener).toHaveBeenCalled();
    });

    it('should call listener immediately', () => {
      const listener = vi.fn();
      const key = 'projectNodes';

      process.addStateListener(key, listener);

      expect(listener).toHaveBeenCalledWith(process.projectNodes);
    });
  });

  describe('removeStateListener()', () => {
    it('should remove state listener', () => {
      const listener = vi.fn();
      const key = 'projectNodes';

      // Add the listener first
      process.addStateListener(key, listener);

      expect(listener).toHaveBeenCalledTimes(1);

      // Remove the listener
      process.removeStateListener(key, listener);

      // Trigger state change again to verify listener is no longer called
      // @ts-expect-error
      process.state.projectNodes = { newNode: { uid: 'newNode' } };
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('deployLatestBuild()', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should successfully deploy latest build', async () => {
      const mockDeploy = {
        deployId: 456,
        buildId: 123,
        status: 'SUCCESS',
        enqueuedAt: '2023-01-01T00:00:00Z',
        startedAt: '2023-01-01T00:01:00Z',
        finishedAt: '2023-01-01T00:05:00Z',
        portalId: 123,
        projectName: 'test-project',
        userId: 789,
        source: 'HUBSPOT_USER',
        subdeployStatuses: [],
      };

      (handleProjectDeploy as Mock).mockResolvedValue(mockDeploy);

      const result = await process.deployLatestBuild();

      expect(mockLocalDevLogger.deployInitiated).toHaveBeenCalled();
      expect(handleProjectDeploy).toHaveBeenCalledWith(
        123, // targetProjectAccountId
        'test-project', // projectName
        123, // buildId
        true, // useV3Api
        false // force
      );
      expect(mockLocalDevLogger.deploySuccess).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        deployId: 456,
      });
    });

    it('should deploy with force parameter', async () => {
      const mockDeploy = {
        deployId: 456,
        buildId: 123,
        status: 'SUCCESS',
        enqueuedAt: '2023-01-01T00:00:00Z',
        startedAt: '2023-01-01T00:01:00Z',
        finishedAt: '2023-01-01T00:05:00Z',
        portalId: 123,
        projectName: 'test-project',
        userId: 789,
        source: 'HUBSPOT_USER',
        subdeployStatuses: [],
      };

      (handleProjectDeploy as Mock).mockResolvedValue(mockDeploy);

      const result = await process.deployLatestBuild(true);

      expect(handleProjectDeploy).toHaveBeenCalledWith(
        123, // targetProjectAccountId
        'test-project', // projectName
        123, // buildId
        true, // useV3Api
        true // force
      );
      expect(result).toEqual({
        success: true,
        deployId: 456,
      });
    });

    it('should return error when no build exists', async () => {
      // Create a process without latestBuild
      const optionsWithoutBuild = {
        ...mockOptions,
        projectData: {
          ...mockOptions.projectData,
          latestBuild: undefined,
        },
      };
      const processWithoutBuild = new LocalDevProcess(optionsWithoutBuild);

      const result = await processWithoutBuild.deployLatestBuild();

      expect(mockLocalDevLogger.deployInitiated).toHaveBeenCalled();
      expect(mockLocalDevLogger.deployError).toHaveBeenCalledWith(
        'Error deploying project. No build was found to deploy.'
      );
      expect(result).toEqual({
        success: false,
      });
      expect(handleProjectDeploy).not.toHaveBeenCalled();
    });

    it('should handle deploy failure when no deploy object returned', async () => {
      (handleProjectDeploy as Mock).mockResolvedValue(undefined);

      const result = await process.deployLatestBuild();

      expect(mockLocalDevLogger.deployInitiated).toHaveBeenCalled();
      expect(handleProjectDeploy).toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
      });
      expect(mockLocalDevLogger.deploySuccess).not.toHaveBeenCalled();
    });
  });
});

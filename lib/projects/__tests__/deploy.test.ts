import { vi } from 'vitest';
import {
  validateBuildIdForDeploy,
  logDeployErrors,
  handleProjectDeploy,
} from '../deploy.js';
import { uiLogger } from '../../ui/logger.js';
import { commands } from '../../../lang/en.js';
import { PROJECT_ERROR_TYPES } from '../../constants.js';
import { deployProject } from '@hubspot/local-dev-lib/api/projects';
import { pollDeployStatus } from '../pollProjectBuildAndDeploy.js';
import {
  Deploy,
  ProjectDeployResponseBlocked,
  ProjectDeployResponseQueued,
} from '@hubspot/local-dev-lib/types/Deploy';

// Mock external dependencies
vi.mock('../../ui/logger.js');
vi.mock('@hubspot/local-dev-lib/api/projects');
vi.mock('../pollProjectBuildAndDeploy.js');

const mockUiLogger = vi.mocked(uiLogger);
const mockDeployProject = vi.mocked(deployProject);
const mockPollDeployStatus = vi.mocked(pollDeployStatus);

describe('lib/projects/deploy', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('validateBuildIdForDeploy()', () => {
    const accountId = 12345;
    const projectName = 'test-project';

    it('returns true when build ID is valid for deployment', () => {
      const buildId = 5;
      const deployedBuildId = 3;
      const latestBuildId = 10;

      const result = validateBuildIdForDeploy(
        buildId,
        deployedBuildId,
        latestBuildId,
        projectName,
        accountId
      );

      expect(result).toBe(true);
    });

    it('returns error message when build ID does not exist', () => {
      const buildId = 15;
      const deployedBuildId = 3;
      const latestBuildId = 10;

      const result = validateBuildIdForDeploy(
        buildId,
        deployedBuildId,
        latestBuildId,
        projectName,
        accountId
      );

      expect(result).toBe(
        commands.project.deploy.errors.buildIdDoesNotExist(
          accountId,
          buildId,
          projectName
        )
      );
    });

    it('returns error message when build is already deployed', () => {
      const buildId = 3;
      const deployedBuildId = 3;
      const latestBuildId = 10;

      const result = validateBuildIdForDeploy(
        buildId,
        deployedBuildId,
        latestBuildId,
        projectName,
        accountId
      );

      expect(result).toBe(
        commands.project.deploy.errors.buildAlreadyDeployed(
          accountId,
          buildId,
          projectName
        )
      );
    });

    it('handles edge case when deployedBuildId is undefined', () => {
      const buildId = 5;
      const deployedBuildId = undefined;
      const latestBuildId = 10;

      const result = validateBuildIdForDeploy(
        buildId,
        deployedBuildId,
        latestBuildId,
        projectName,
        accountId
      );

      expect(result).toBe(true);
    });
  });

  describe('logDeployErrors()', () => {
    it('logs main error message and individual error messages', () => {
      const errorData = {
        message: 'Deploy failed with errors',
        errors: [
          {
            message: 'Component error 1',
            subCategory: 'SOME_ERROR',
            context: { COMPONENT_NAME: 'test-component' },
          },
          {
            message: 'Component error 2',
            subCategory: 'ANOTHER_ERROR',
            context: { COMPONENT_NAME: 'another-component' },
          },
        ],
      };

      logDeployErrors(errorData);

      expect(mockUiLogger.error).toHaveBeenCalledWith(
        'Deploy failed with errors'
      );
      expect(mockUiLogger.log).toHaveBeenCalledWith('Component error 1');
      expect(mockUiLogger.log).toHaveBeenCalledWith('Component error 2');
    });

    it('handles DEPLOY_CONTAINS_REMOVALS error type specially', () => {
      const errorData = {
        message: 'Deploy contains removals',
        errors: [
          {
            message: 'Component will be removed',
            subCategory: PROJECT_ERROR_TYPES.DEPLOY_CONTAINS_REMOVALS,
            context: { COMPONENT_NAME: 'removed-component' },
          },
        ],
      };

      logDeployErrors(errorData);

      expect(mockUiLogger.error).toHaveBeenCalledWith(
        'Deploy contains removals'
      );
      expect(mockUiLogger.log).toHaveBeenCalledWith(
        commands.project.deploy.errors.deployContainsRemovals(
          'removed-component'
        )
      );
    });

    it('handles empty errors array', () => {
      const errorData = {
        message: 'No specific errors',
        errors: [],
      };

      logDeployErrors(errorData);

      expect(mockUiLogger.error).toHaveBeenCalledWith('No specific errors');
      expect(mockUiLogger.log).not.toHaveBeenCalled();
    });
  });

  describe('handleProjectDeploy()', () => {
    const targetAccountId = 12345;
    const projectName = 'test-project';
    const buildId = 5;
    const useV2Api = true;
    const force = false;

    it('successfully deploys and returns deploy result', async () => {
      const mockDeployResponseData: ProjectDeployResponseQueued = {
        id: 'deploy-123',
        buildResultType: 'DEPLOY_QUEUED',
        links: {
          status: 'http://status-url',
        },
      };
      const mockDeployResult: Deploy = {
        deployId: 123,
        buildId: 5,
        status: 'SUCCESS',
        enqueuedAt: '2023-01-01T00:00:00Z',
        startedAt: '2023-01-01T00:01:00Z',
        finishedAt: '2023-01-01T00:05:00Z',
        portalId: targetAccountId,
        projectName: 'test-project',
        userId: 456,
        source: 'HUBSPOT_USER',
        subdeployStatuses: [],
      };

      mockDeployProject.mockResolvedValue({
        data: mockDeployResponseData,
      } as never);
      mockPollDeployStatus.mockResolvedValue(mockDeployResult);

      const deploy = await handleProjectDeploy(
        targetAccountId,
        projectName,
        buildId,
        useV2Api,
        force
      );

      expect(mockDeployProject).toHaveBeenCalledWith(
        targetAccountId,
        projectName,
        buildId,
        useV2Api,
        force
      );
      expect(deploy).toEqual(mockDeployResult);
    });

    it('handles blocked deploy with warnings', async () => {
      const mockBlockedResponse: ProjectDeployResponseBlocked = {
        buildResultType: 'DEPLOY_BLOCKED',
        issues: [
          {
            uid: 'component-1',
            componentTypeName: 'module',
            errorMessages: [],
            blockingMessages: [
              {
                message: 'This is a warning',
                isWarning: true,
              },
            ],
          },
        ],
      };

      mockDeployProject.mockResolvedValue({
        data: mockBlockedResponse,
      } as never);

      await handleProjectDeploy(
        targetAccountId,
        projectName,
        buildId,
        useV2Api,
        force
      );

      expect(mockUiLogger.warn).toHaveBeenCalledWith(
        commands.project.deploy.errors.deployWarningsHeader
      );
    });

    it('handles blocked deploy with errors (cannot be forced)', async () => {
      const mockBlockedResponse: ProjectDeployResponseBlocked = {
        buildResultType: 'DEPLOY_BLOCKED',
        issues: [
          {
            uid: 'component-1',
            componentTypeName: 'module',
            errorMessages: [],
            blockingMessages: [
              {
                message: 'This is an error',
                isWarning: false,
              },
            ],
          },
        ],
      };

      mockDeployProject.mockResolvedValue({
        data: mockBlockedResponse,
      } as never);

      await handleProjectDeploy(
        targetAccountId,
        projectName,
        buildId,
        useV2Api,
        force
      );

      expect(mockUiLogger.error).toHaveBeenCalledWith(
        commands.project.deploy.errors.deployBlockedHeader
      );
      expect(mockUiLogger.log).toHaveBeenCalledWith(
        commands.project.deploy.errors.deployIssueComponentWarning(
          'component-1',
          'module',
          'This is an error'
        )
      );
    });

    it('handles blocked deploy with no blocking messages', async () => {
      const mockBlockedResponse: ProjectDeployResponseBlocked = {
        buildResultType: 'DEPLOY_BLOCKED',
        issues: [
          {
            uid: 'component-1',
            componentTypeName: 'module',
            errorMessages: [],
            blockingMessages: [],
          },
        ],
      };

      mockDeployProject.mockResolvedValue({
        data: mockBlockedResponse,
      } as never);

      await handleProjectDeploy(
        targetAccountId,
        projectName,
        buildId,
        useV2Api,
        force
      );

      expect(mockUiLogger.warn).toHaveBeenCalledWith(
        commands.project.deploy.errors.deployWarningsHeader
      );
      expect(mockUiLogger.log).toHaveBeenCalledWith(
        commands.project.deploy.errors.deployIssueComponentGeneric(
          'component-1',
          'module'
        )
      );
    });

    it('handles general deploy failure', async () => {
      mockDeployProject.mockResolvedValue({ data: null } as never);

      const deploy = await handleProjectDeploy(
        targetAccountId,
        projectName,
        buildId,
        useV2Api,
        force
      );

      expect(mockUiLogger.error).toHaveBeenCalledWith(
        commands.project.deploy.errors.deploy
      );
      expect(deploy).toBeUndefined();
    });

    it('handles undefined deploy response', async () => {
      mockDeployProject.mockResolvedValue({ data: undefined } as never);

      const deploy = await handleProjectDeploy(
        targetAccountId,
        projectName,
        buildId,
        useV2Api,
        force
      );

      expect(mockUiLogger.error).toHaveBeenCalledWith(
        commands.project.deploy.errors.deploy
      );
      expect(deploy).toBeUndefined();
    });

    it('passes correct parameters to deployProject', async () => {
      const mockDeployResponseData: ProjectDeployResponseQueued = {
        id: 'deploy-123',
        buildResultType: 'DEPLOY_QUEUED',
        links: {
          status: 'http://status-url',
        },
      };

      mockDeployProject.mockResolvedValue({
        data: mockDeployResponseData,
      } as never);
      mockPollDeployStatus.mockResolvedValue({} as Deploy);

      await handleProjectDeploy(
        targetAccountId,
        projectName,
        buildId,
        false,
        true
      );

      expect(mockDeployProject).toHaveBeenCalledWith(
        targetAccountId,
        projectName,
        buildId,
        false, // useV2Api
        true // force
      );
    });
  });
});

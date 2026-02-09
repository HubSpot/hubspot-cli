import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import {
  pollBuildStatus,
  pollDeployStatus,
} from '../pollProjectBuildAndDeploy.js';
import {
  getBuildStatus,
  getBuildStructure,
  getDeployStatus,
  getDeployStructure,
} from '@hubspot/local-dev-lib/api/projects';
import SpinniesManager from '../../ui/SpinniesManager.js';
import { uiLogger } from '../../ui/logger.js';
import { Build } from '@hubspot/local-dev-lib/types/Build';
import { Deploy } from '@hubspot/local-dev-lib/types/Deploy';

// Mock external dependencies
vi.mock('@hubspot/local-dev-lib/api/projects');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../ui/SpinniesManager.js');
vi.mock('../../ui/index.js', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    uiLine: vi.fn(),
    uiLink: vi.fn((text: string) => text),
    uiAccountDescription: vi.fn((accountId: number) => `account ${accountId}`),
  };
});
vi.mock('../../errorHandlers/index.js');

const mockGetBuildStatus = vi.mocked(getBuildStatus);
const mockGetBuildStructure = vi.mocked(getBuildStructure);
const mockGetDeployStatus = vi.mocked(getDeployStatus);
const mockGetDeployStructure = vi.mocked(getDeployStructure);

describe('lib/projects/pollProjectBuildAndDeploy', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();

    // Mock SpinniesManager methods
    vi.mocked(SpinniesManager.init).mockImplementation(() => {});
    vi.mocked(SpinniesManager.add).mockImplementation(() => {});
    vi.mocked(SpinniesManager.update).mockImplementation(() => {});
    vi.mocked(SpinniesManager.succeed).mockImplementation(() => {});
    vi.mocked(SpinniesManager.fail).mockImplementation(() => {});
    vi.mocked(SpinniesManager.remove).mockImplementation(() => {});
    vi.mocked(SpinniesManager.pick).mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('pollBuildStatus', () => {
    it('logs correct INITIALIZE message when build starts', async () => {
      const mockBuild: Build = {
        buildId: 123,
        status: 'SUCCESS',
        subbuildStatuses: [],
        enqueuedAt: '2023-01-01T00:00:00Z',
        startedAt: '2023-01-01T00:01:00Z',
        finishedAt: '2023-01-01T00:05:00Z',
        portalId: 12345,
        projectName: 'test-project',
        // @ts-expect-error - Testing with minimal Build object, activitySource not relevant for this test
        activitySource: undefined,
        // @ts-expect-error - Testing with minimal Build object, createdAt not relevant for this test
        createdAt: undefined,
        // @ts-expect-error - Testing with minimal Build object, deployableState not relevant for this test
        deployableState: undefined,
        // @ts-expect-error - Testing successful build without deploy locator
        deployStatusTaskLocator: undefined,
        source: 'HUBSPOT_USER',
        isAutoDeployEnabled: false,
        autoDeployId: 0,
      };

      mockGetBuildStatus.mockResolvedValue({ data: mockBuild } as never);
      mockGetBuildStructure.mockResolvedValue({
        data: { topLevelComponentsWithChildren: {} },
      } as never);

      pollBuildStatus(12345, 'test-project', 123, null, true);

      // Wait for initial async setup to complete
      await vi.waitFor(() => {
        expect(SpinniesManager.update).toHaveBeenCalled();
      });

      // Check that SpinniesManager.update was called with correct INITIALIZE message
      expect(SpinniesManager.update).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          text: expect.stringContaining(
            `Building ${chalk.bold('test-project')} #123`
          ),
        })
      );

      // Complete the polling
      vi.mocked(SpinniesManager.hasActiveSpinners).mockReturnValue(true);
      await vi.runOnlyPendingTimersAsync();
    });

    it('logs correct SUCCESS message when build completes', async () => {
      const mockBuild: Build = {
        buildId: 456,
        status: 'SUCCESS',
        subbuildStatuses: [],
        enqueuedAt: '2023-01-01T00:00:00Z',
        startedAt: '2023-01-01T00:01:00Z',
        finishedAt: '2023-01-01T00:05:00Z',
        portalId: 12345,
        projectName: 'my-project',
        // @ts-expect-error - Testing with minimal Build object, non-essential fields omitted
        activitySource: undefined,
        // @ts-expect-error - Testing with minimal Build object, non-essential fields omitted
        createdAt: undefined,
        // @ts-expect-error - Testing with minimal Build object, non-essential fields omitted
        deployableState: undefined,
        // @ts-expect-error - Testing successful build without deploy locator
        deployStatusTaskLocator: undefined,
        source: 'HUBSPOT_USER',
        isAutoDeployEnabled: false,
        autoDeployId: 0,
      };

      mockGetBuildStatus.mockResolvedValue({ data: mockBuild } as never);
      mockGetBuildStructure.mockResolvedValue({
        data: { topLevelComponentsWithChildren: {} },
      } as never);
      vi.mocked(SpinniesManager.hasActiveSpinners).mockReturnValue(true);

      pollBuildStatus(12345, 'my-project', 456, null, true);

      // Wait for polling to complete
      vi.mocked(SpinniesManager.hasActiveSpinners).mockReturnValue(true);
      await vi.runOnlyPendingTimersAsync();

      // Check that SpinniesManager.succeed was called with correct SUCCESS message
      expect(SpinniesManager.succeed).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          text: `Built ${chalk.bold('my-project')} #456`,
        })
      );
    });

    it('logs correct FAIL message when build fails', async () => {
      const mockBuild: Build = {
        buildId: 789,
        status: 'FAILURE',
        subbuildStatuses: [],
        enqueuedAt: '2023-01-01T00:00:00Z',
        startedAt: '2023-01-01T00:01:00Z',
        finishedAt: '2023-01-01T00:05:00Z',
        portalId: 12345,
        projectName: 'failed-project',
        // @ts-expect-error - Testing with minimal Build object, non-essential fields omitted
        activitySource: undefined,
        // @ts-expect-error - Testing with minimal Build object, non-essential fields omitted
        createdAt: undefined,
        // @ts-expect-error - Testing with minimal Build object, non-essential fields omitted
        deployableState: undefined,
        // @ts-expect-error - Testing failed build without deploy locator
        deployStatusTaskLocator: undefined,
        source: 'HUBSPOT_USER',
        isAutoDeployEnabled: false,
        autoDeployId: 0,
      };

      mockGetBuildStatus.mockResolvedValue({ data: mockBuild } as never);
      mockGetBuildStructure.mockResolvedValue({
        data: { topLevelComponentsWithChildren: {} },
      } as never);
      vi.mocked(SpinniesManager.hasActiveSpinners).mockReturnValue(true);

      pollBuildStatus(12345, 'failed-project', 789, null, true);

      // Wait for polling to complete
      await vi.runOnlyPendingTimersAsync();

      // Check that SpinniesManager.fail was called with correct FAIL message
      expect(SpinniesManager.fail).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          text: `Failed to build ${chalk.bold('failed-project')} #789`,
        })
      );
    });

    it('logs correct SUBTASK_FAIL message with proper parameter order', async () => {
      const mockBuild: Build = {
        buildId: 999,
        status: 'FAILURE',
        subbuildStatuses: [
          {
            id: 'sub-1',
            buildName: 'api-component',
            buildType: 'APP',
            status: 'FAILURE',
            visible: true,
            errorMessage: 'Build failed',
            standardError: null,
            finishedAt: '2023-01-01T00:05:00Z',
            rootPath: '/src',
            startedAt: '2023-01-01T00:01:00Z',
          },
        ],
        enqueuedAt: '2023-01-01T00:00:00Z',
        startedAt: '2023-01-01T00:01:00Z',
        finishedAt: '2023-01-01T00:05:00Z',
        portalId: 12345,
        projectName: 'test-project',
        // @ts-expect-error - Testing with minimal Build object, non-essential fields omitted
        activitySource: undefined,
        // @ts-expect-error - Testing with minimal Build object, non-essential fields omitted
        createdAt: undefined,
        // @ts-expect-error - Testing with minimal Build object, non-essential fields omitted
        deployableState: undefined,
        // @ts-expect-error - Testing failed build without deploy locator
        deployStatusTaskLocator: undefined,
        source: 'HUBSPOT_USER',
        isAutoDeployEnabled: false,
        autoDeployId: 0,
      };

      mockGetBuildStatus.mockResolvedValue({ data: mockBuild } as never);
      mockGetBuildStructure.mockResolvedValue({
        data: { topLevelComponentsWithChildren: { 'sub-1': [] } },
      } as never);
      vi.mocked(SpinniesManager.hasActiveSpinners).mockReturnValue(true);

      pollBuildStatus(12345, 'test-project', 999, null, false);

      // Wait for polling to complete
      await vi.runOnlyPendingTimersAsync();

      // Verify SUBTASK_FAIL message has correct parameter order (name first, buildId second)
      // The message should be: "Build #999 failed because there was a problem\nbuilding api-component"
      expect(uiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Build #999 failed because there was a problem')
      );
      expect(uiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining(`building ${chalk.bold('api-component')}`)
      );
    });
  });

  describe('pollDeployStatus', () => {
    it('logs correct INITIALIZE message when deploy starts', async () => {
      const mockDeploy: Deploy = {
        deployId: 123,
        buildId: 100,
        status: 'SUCCESS',
        subdeployStatuses: [],
        enqueuedAt: '2023-01-01T00:00:00Z',
        startedAt: '2023-01-01T00:01:00Z',
        finishedAt: '2023-01-01T00:05:00Z',
        portalId: 12345,
        projectName: 'test-project',
        userId: 456,
        source: 'HUBSPOT_USER',
      };

      mockGetDeployStatus.mockResolvedValue({ data: mockDeploy } as never);
      mockGetDeployStructure.mockResolvedValue({
        data: { topLevelComponentsWithChildren: {} },
      } as never);

      pollDeployStatus(12345, 'test-project', 123, 100, true);

      // Wait for initial async setup to complete
      await vi.waitFor(() => {
        expect(SpinniesManager.update).toHaveBeenCalled();
      });

      // Check that SpinniesManager.update was called with correct INITIALIZE message
      expect(SpinniesManager.update).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          text: expect.stringContaining(
            `Deploying build #100 in ${chalk.bold('test-project')}`
          ),
        })
      );

      // Complete the polling
      vi.mocked(SpinniesManager.hasActiveSpinners).mockReturnValue(true);
      await vi.runOnlyPendingTimersAsync();
    });

    it('logs correct SUCCESS message when deploy completes', async () => {
      const mockDeploy: Deploy = {
        deployId: 456,
        buildId: 200,
        status: 'SUCCESS',
        subdeployStatuses: [],
        enqueuedAt: '2023-01-01T00:00:00Z',
        startedAt: '2023-01-01T00:01:00Z',
        finishedAt: '2023-01-01T00:05:00Z',
        portalId: 12345,
        projectName: 'my-project',
        userId: 456,
        source: 'HUBSPOT_USER',
      };

      mockGetDeployStatus.mockResolvedValue({ data: mockDeploy } as never);
      mockGetDeployStructure.mockResolvedValue({
        data: { topLevelComponentsWithChildren: {} },
      } as never);
      vi.mocked(SpinniesManager.hasActiveSpinners).mockReturnValue(true);

      pollDeployStatus(12345, 'my-project', 456, 200, true);

      // Wait for polling to complete
      await vi.runOnlyPendingTimersAsync();

      // Check that SpinniesManager.succeed was called with correct SUCCESS message
      expect(SpinniesManager.succeed).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          text: `Deployed build #200 in ${chalk.bold('my-project')}`,
        })
      );
    });

    it('logs correct FAIL message when deploy fails', async () => {
      const mockDeploy: Deploy = {
        deployId: 789,
        buildId: 300,
        status: 'FAILURE',
        subdeployStatuses: [],
        enqueuedAt: '2023-01-01T00:00:00Z',
        startedAt: '2023-01-01T00:01:00Z',
        finishedAt: '2023-01-01T00:05:00Z',
        portalId: 12345,
        projectName: 'failed-project',
        userId: 456,
        source: 'HUBSPOT_USER',
      };

      mockGetDeployStatus.mockResolvedValue({ data: mockDeploy } as never);
      mockGetDeployStructure.mockResolvedValue({
        data: { topLevelComponentsWithChildren: {} },
      } as never);
      vi.mocked(SpinniesManager.hasActiveSpinners).mockReturnValue(true);

      pollDeployStatus(12345, 'failed-project', 789, 300, true);

      // Wait for polling to complete
      await vi.runOnlyPendingTimersAsync();

      // Check that SpinniesManager.fail was called with correct FAIL message
      expect(SpinniesManager.fail).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          text: `Failed to deploy build #300 in ${chalk.bold('failed-project')}`,
        })
      );
    });

    it('logs correct SUBTASK_FAIL message with proper parameter order', async () => {
      const mockDeploy: Deploy = {
        deployId: 888,
        buildId: 999,
        status: 'FAILURE',
        subdeployStatuses: [
          {
            id: 'sub-1',
            deployName: 'api-component',
            deployType: 'APP',
            status: 'FAILURE',
            visible: true,
            errorMessage: 'Deploy failed',
            standardError: null,
            action: 'DEPLOY',
            finishedAt: '2023-01-01T00:05:00Z',
            startedAt: '2023-01-01T00:01:00Z',
          },
        ],
        enqueuedAt: '2023-01-01T00:00:00Z',
        startedAt: '2023-01-01T00:01:00Z',
        finishedAt: '2023-01-01T00:05:00Z',
        portalId: 12345,
        projectName: 'test-project',
        userId: 456,
        source: 'HUBSPOT_USER',
      };

      mockGetDeployStatus.mockResolvedValue({ data: mockDeploy } as never);
      mockGetDeployStructure.mockResolvedValue({
        data: { topLevelComponentsWithChildren: { 'sub-1': [] } },
      } as never);
      vi.mocked(SpinniesManager.hasActiveSpinners).mockReturnValue(true);

      pollDeployStatus(12345, 'test-project', 888, 999, false);

      // Wait for polling to complete
      await vi.runOnlyPendingTimersAsync();

      // Verify SUBTASK_FAIL message has correct parameter order (name first, deployedBuildId second)
      // The message should be: "Deploy for build #999 failed because there was a\nproblem deploying api-component"
      expect(uiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining(
          'Deploy for build #999 failed because there was a'
        )
      );
      expect(uiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining(`deploying ${chalk.bold('api-component')}`)
      );
    });
  });
});

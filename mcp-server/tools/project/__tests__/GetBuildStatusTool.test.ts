import { GetBuildStatusTool } from '../GetBuildStatusTool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../../utils/logger.js';
import {
  fetchProjectBuilds,
  getBuildStatus,
} from '@hubspot/local-dev-lib/api/projects';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import {
  getProjectConfig,
  validateProjectConfig,
} from '../../../../lib/projects/config.js';
import { MockedFunction, Mocked } from 'vitest';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';
import { discoverAccountTargets } from '../../../../lib/accountTargetDiscovery.js';
import type { AccountTargetCandidate } from '../../../../types/AccountTargets.js';
import { ACCOUNT_TARGET_SELECTION_SOURCES } from '../../../../types/AccountTargets.js';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../../utils/logger.js');
vi.mock('@hubspot/local-dev-lib/api/projects');
vi.mock('@hubspot/local-dev-lib/errors/index');
vi.mock('../../../../lib/projects/config.js');
vi.mock('../../../utils/feedbackTracking');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../../../lib/accountTargetDiscovery.js');

const mockMcpFeedbackRequest = mcpFeedbackRequest as MockedFunction<
  typeof mcpFeedbackRequest
>;
const mockFetchProjectBuilds = fetchProjectBuilds as MockedFunction<
  typeof fetchProjectBuilds
>;
const mockGetBuildStatus = getBuildStatus as MockedFunction<
  typeof getBuildStatus
>;
const mockIsHubSpotHttpError = isHubSpotHttpError as unknown as MockedFunction<
  typeof isHubSpotHttpError
>;
const mockGetProjectConfig = getProjectConfig as MockedFunction<
  typeof getProjectConfig
>;
const mockValidateProjectConfig = validateProjectConfig as MockedFunction<
  typeof validateProjectConfig
>;
const mockedDiscoverAccountTargets = vi.mocked(discoverAccountTargets);

const TEST_ACCOUNT_ID = 123456789;
const TEST_PROJECT_NAME = 'test-project';
const TEST_PROJECT_PATH = '/test/project';
const TEST_WORKING_DIR = '/test';
const TEST_PLATFORM_VERSION = '2025.2';

function createMockBuild(overrides = {}) {
  return {
    buildId: 10,
    status: 'FAILURE',
    createdAt: '2025-11-18T21:50:50.632Z',
    enqueuedAt: null,
    finishedAt: '2025-11-20T22:32:07.008Z',
    startedAt: '2025-11-18T21:50:50.632Z',
    subbuildStatuses: [
      {
        buildName: 'my-card',
        buildType: 'CARD',
        status: 'FAILURE',
        errorMessage:
          'There were errors building this component:\n - The preview image file /app/cards/assets/preview.png was not found. Make sure the file exists in /app/cards and try again.',
      },
      {
        buildName: 'my-app',
        buildType: 'APPLICATION',
        status: 'SUCCESS',
        errorMessage: '',
      },
    ],
    buildErrorMessage:
      'The source code for this project is too large. HubSpot projects have a maximum size limit of 50.0 MB.',
    platformVersion: TEST_PLATFORM_VERSION,
    deployable: true,
    deployableState: 'DEPLOYABLE',
    ...overrides,
  };
}

function createMockProjectConfig(overrides = {}) {
  return {
    name: TEST_PROJECT_NAME,
    srcDir: 'src',
    platformVersion: TEST_PLATFORM_VERSION,
    ...overrides,
  };
}

function createBuildListResponse(builds: ReturnType<typeof createMockBuild>[]) {
  return {
    data: {
      results: builds,
      paging: undefined,
    },
  };
}

function createBuildDetailsResponse(build: ReturnType<typeof createMockBuild>) {
  return {
    data: build,
  };
}

function expectTextContent(
  result: { content: Array<{ text: string }> },
  ...expectedStrings: string[]
) {
  expectedStrings.forEach(str => {
    expect(result.content[1].text).toContain(str);
  });
}

describe('mcp-server/tools/project/GetBuildStatusTool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let mockLogger: Mocked<McpLogger>;
  let tool: GetBuildStatusTool;
  let mockRegisteredTool: RegisteredTool;

  beforeEach(() => {
    // @ts-expect-error Not mocking the whole thing
    mockMcpServer = {
      registerTool: vi.fn(),
    };

    // @ts-expect-error Not mocking the whole thing
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockRegisteredTool = {} as RegisteredTool;
    mockMcpServer.registerTool.mockReturnValue(mockRegisteredTool);
    mockMcpFeedbackRequest.mockResolvedValue('');

    tool = new GetBuildStatusTool(mockMcpServer, mockLogger);

    // Default mock implementations
    mockIsHubSpotHttpError.mockReturnValue(false);
    mockGetProjectConfig.mockResolvedValue({
      projectConfig: createMockProjectConfig(),
      projectDir: TEST_PROJECT_PATH,
    });
    mockValidateProjectConfig.mockImplementation(() => {});
    mockedDiscoverAccountTargets.mockResolvedValue({
      candidates: [],
      recommended: { accountId: TEST_ACCOUNT_ID } as AccountTargetCandidate,
    });
  });

  describe('register', () => {
    it('should register tool with correct parameters', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'get-build-status',
        expect.objectContaining({
          title: 'Get HubSpot Projects Build Status and Errors',
          description: expect.stringContaining(
            'Retrieves build status and error messages for HubSpot projects'
          ),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function)
      );
      expect(result).toBe(mockRegisteredTool);
    });
  });

  describe('handler', () => {
    const baseInput = {
      absoluteProjectPath: TEST_PROJECT_PATH,
      absoluteCurrentWorkingDirectory: TEST_WORKING_DIR,
      buildId: undefined,
      limit: 5,
    };

    describe('account resolution', () => {
      it('should pass project config to discoverAccountTargets for profile resolution', async () => {
        mockFetchProjectBuilds.mockResolvedValue(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          createBuildListResponse([createMockBuild()]) as any
        );

        await tool.handler(baseInput);

        expect(mockedDiscoverAccountTargets).toHaveBeenCalledWith({
          projectDir: TEST_PROJECT_PATH,
          projectConfig: createMockProjectConfig(),
        });
      });

      it('should use the account from a linked directory over the global default', async () => {
        const LINKED_ACCOUNT_ID = 987654321;
        mockedDiscoverAccountTargets.mockResolvedValue({
          candidates: [
            {
              accountId: LINKED_ACCOUNT_ID,
              source: ACCOUNT_TARGET_SELECTION_SOURCES.LINKED_DIRECTORY,
            } as AccountTargetCandidate,
          ],
          recommended: {
            accountId: LINKED_ACCOUNT_ID,
            source: ACCOUNT_TARGET_SELECTION_SOURCES.LINKED_DIRECTORY,
          } as AccountTargetCandidate,
        });
        mockFetchProjectBuilds.mockResolvedValue(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          createBuildListResponse([createMockBuild()]) as any
        );

        await tool.handler(baseInput);

        expect(mockFetchProjectBuilds).toHaveBeenCalledWith(
          LINKED_ACCOUNT_ID,
          TEST_PROJECT_NAME,
          expect.any(Object)
        );
      });
    });

    describe('error handling', () => {
      it('should return error when account ID cannot be determined', async () => {
        mockedDiscoverAccountTargets.mockResolvedValue({
          candidates: [],
          recommended: undefined,
        });

        const result = await tool.handler(baseInput);

        expect(result).toEqual({
          content: [
            {
              type: 'text',
              text: TEST_WORKING_DIR,
            },
            {
              type: 'text',
              text: 'No account ID found. Call the auth-account tool to authenticate a HubSpot account.',
            },
          ],
        });
        expect(mockFetchProjectBuilds).not.toHaveBeenCalled();
      });

      it('should return error when specific build for provided buildId is not found', async () => {
        const error = new Error('Build not found');
        // @ts-expect-error Adding status property
        error.status = 404;
        mockIsHubSpotHttpError.mockReturnValue(true);
        mockGetBuildStatus.mockRejectedValue(error);

        const result = await tool.handler({ ...baseInput, buildId: 999 });

        expectTextContent(result, 'Build not found');
      });

      it('should handle HubSpot HTTP errors', async () => {
        const error = new Error('API Error');
        mockIsHubSpotHttpError.mockReturnValue(true);
        mockFetchProjectBuilds.mockRejectedValue(error);

        const result = await tool.handler(baseInput);

        expectTextContent(result, 'API Error');
      });

      it('should handle generic errors', async () => {
        const error = new Error('Generic error');
        mockIsHubSpotHttpError.mockReturnValue(false);
        mockFetchProjectBuilds.mockRejectedValue(error);

        const result = await tool.handler(baseInput);

        expectTextContent(result, 'Generic error');
      });
    });

    describe('list view (no buildId)', () => {
      it('should return recent builds when no buildId is provided', async () => {
        const mockBuild = createMockBuild();
        mockFetchProjectBuilds.mockResolvedValue(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          createBuildListResponse([mockBuild]) as any
        );

        const result = await tool.handler(baseInput);

        expect(mockGetProjectConfig).toHaveBeenCalledWith(TEST_PROJECT_PATH);
        expect(mockFetchProjectBuilds).toHaveBeenCalledWith(
          TEST_ACCOUNT_ID,
          TEST_PROJECT_NAME,
          { limit: 5 }
        );

        expectTextContent(
          result,
          `Recent builds for '${TEST_PROJECT_NAME}':`,
          'Build #10 - FAILURE',
          'The source code for this project is too large'
        );
      });

      it('should return error when no builds exist', async () => {
        mockFetchProjectBuilds.mockResolvedValue(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          createBuildListResponse([]) as any
        );

        const result = await tool.handler(baseInput);

        expectTextContent(
          result,
          `No builds found for project '${TEST_PROJECT_NAME}'`
        );
      });

      it('should handle successful builds', async () => {
        const successBuild = createMockBuild({
          buildId: 11,
          status: 'SUCCESS',
          buildErrorMessage: undefined,
          subbuildStatuses: [
            {
              buildName: 'my-app',
              buildType: 'APPLICATION',
              status: 'SUCCESS',
              errorMessage: '',
            },
          ],
        });
        mockFetchProjectBuilds.mockResolvedValue(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          createBuildListResponse([successBuild]) as any
        );

        const result = await tool.handler(baseInput);

        expectTextContent(result, 'Build #11 - SUCCESS ✓');
        expect(result.content[1].text).not.toContain('Error:');
      });

      it('should display all subbuilds (success and failure)', async () => {
        const buildWithSubbuilds = createMockBuild({
          subbuildStatuses: [
            {
              buildName: 'my-webhooks',
              buildType: 'WEBHOOKS',
              status: 'SUCCESS',
            },
            {
              buildName: 'my-app',
              buildType: 'APPLICATION',
              status: 'FAILURE',
              errorMessage: 'Duplicate UID',
            },
          ],
        });
        mockFetchProjectBuilds.mockResolvedValue(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          createBuildListResponse([buildWithSubbuilds]) as any
        );

        const result = await tool.handler(baseInput);

        expectTextContent(
          result,
          'Subbuilds:',
          '✓ my-webhooks (WEBHOOKS): SUCCESS',
          '⚠️ my-app (APPLICATION): FAILURE',
          'Error: Duplicate UID'
        );
      });
    });

    describe('detail view (with buildId)', () => {
      it('should return specific build details when buildId is provided', async () => {
        const mockBuild = createMockBuild();
        mockGetBuildStatus.mockResolvedValue(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          createBuildDetailsResponse(mockBuild) as any
        );

        const result = await tool.handler({ ...baseInput, buildId: 10 });

        expect(mockGetBuildStatus).toHaveBeenCalledWith(
          TEST_ACCOUNT_ID,
          TEST_PROJECT_NAME,
          10
        );

        expectTextContent(
          result,
          'Build #10 Details',
          'Status: FAILURE',
          `Platform Version: ${TEST_PLATFORM_VERSION}`,
          'Build Error:'
        );
      });
    });
  });
});

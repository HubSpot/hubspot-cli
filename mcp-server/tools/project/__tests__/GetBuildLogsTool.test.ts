import { GetBuildLogsTool } from '../GetBuildLogsTool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../../utils/logger.js';
import { http } from '@hubspot/local-dev-lib/http';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import {
  getProjectConfig,
  validateProjectConfig,
} from '../../../../lib/projects/config.js';
import { MockedFunction, Mocked } from 'vitest';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';
import { ProjectLog } from '@hubspot/local-dev-lib/types/ProjectLog';
import { getConfigDefaultAccountIfExists } from '@hubspot/local-dev-lib/config';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../../utils/logger.js');
vi.mock('../../../utils/cliConfig');
vi.mock('@hubspot/local-dev-lib/http');
vi.mock('@hubspot/local-dev-lib/errors/index');
vi.mock('../../../../lib/projects/config.js');
vi.mock('../../../utils/feedbackTracking');
vi.mock('@hubspot/local-dev-lib/config');

const mockMcpFeedbackRequest = mcpFeedbackRequest as MockedFunction<
  typeof mcpFeedbackRequest
>;

const mockGetConfigDefaultAccountIfExists =
  getConfigDefaultAccountIfExists as MockedFunction<
    typeof getConfigDefaultAccountIfExists
  >;
const mockHttpGet = http.get as MockedFunction<typeof http.get>;
const mockIsHubSpotHttpError = isHubSpotHttpError as unknown as MockedFunction<
  typeof isHubSpotHttpError
>;
const mockGetProjectConfig = getProjectConfig as MockedFunction<
  typeof getProjectConfig
>;
const mockValidateProjectConfig = validateProjectConfig as MockedFunction<
  typeof validateProjectConfig
>;

const TEST_ACCOUNT_ID = 123456789;
const TEST_PROJECT_NAME = 'test-project';
const TEST_PROJECT_PATH = '/test/project';
const TEST_WORKING_DIR = '/test';
const TEST_BUILD_ID = 123;
const TEST_PLATFORM_VERSION = '2025.2';

function createMockLog(overrides: Partial<ProjectLog> = {}): ProjectLog {
  return {
    lineNumber: 1,
    logLevel: 'INFO',
    message: 'Starting build validation',
    pipelineStepId: 1,
    pipelineSubstepId: 'test-step',
    pipelineSubstepName: 'test-component',
    timestamp: Date.now(),
    ...overrides,
  };
}

function createMockLogs() {
  return {
    pipelineStage: 'BUILD',
    pipelineStepId: 2,
    projectName: TEST_PROJECT_NAME,
    logs: [
      {
        pipelineStepId: 2,
        pipelineSubstepId: 'test-app-id',
        pipelineStage: 'BUILD',
        projectName: TEST_PROJECT_NAME,
        logs: [
          createMockLog({
            lineNumber: 1,
            logLevel: 'INFO',
            message: "Starting build validation for app 'Test App'",
            pipelineSubstepName: 'test-app',
            pipelineSubstepId: 'test-app-id',
          }),
          createMockLog({
            lineNumber: 2,
            logLevel: 'INFO',
            message: "Successfully validated app configuration for 'Test App'",
            pipelineSubstepName: 'test-app',
            pipelineSubstepId: 'test-app-id',
          }),
        ],
      },
      {
        pipelineStepId: 2,
        pipelineSubstepId: 'test-card-id',
        pipelineStage: 'BUILD',
        projectName: TEST_PROJECT_NAME,
        logs: [
          createMockLog({
            lineNumber: 1,
            logLevel: 'INFO',
            message: 'Starting card build...',
            pipelineSubstepName: 'test-card',
            pipelineSubstepId: 'test-card-id',
          }),
          createMockLog({
            lineNumber: 2,
            logLevel: 'INFO',
            message: 'Validating card configuration...',
            pipelineSubstepName: 'test-card',
            pipelineSubstepId: 'test-card-id',
          }),
          createMockLog({
            lineNumber: 3,
            logLevel: 'ERROR',
            message:
              'Failed to build card. The preview image file /app/cards/assets/preview.png was not found. Make sure the file exists in /app/cards and try again.',
            pipelineSubstepName: 'test-card',
            pipelineSubstepId: 'test-card-id',
          }),
        ],
      },
      {
        pipelineStepId: 2,
        pipelineSubstepId: 'test-webhook-id',
        pipelineStage: 'BUILD',
        projectName: TEST_PROJECT_NAME,
        logs: [
          createMockLog({
            lineNumber: 1,
            logLevel: 'WARN',
            message: 'Deprecated API usage detected in webhook configuration',
            pipelineSubstepName: 'test-webhook',
            pipelineSubstepId: 'test-webhook-id',
          }),
        ],
      },
    ],
  };
}

function createLogsResponse(data: ReturnType<typeof createMockLogs>) {
  return {
    data,
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

function expectTextContent(
  result: { content: Array<{ text: string }> },
  ...expectedStrings: string[]
) {
  expectedStrings.forEach(str => {
    expect(result.content[1].text).toContain(str);
  });
}

describe('mcp-server/tools/project/GetBuildLogsTool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let mockLogger: Mocked<McpLogger>;
  let tool: GetBuildLogsTool;
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

    tool = new GetBuildLogsTool(mockMcpServer, mockLogger);

    // Default mock implementations
    mockGetConfigDefaultAccountIfExists.mockReturnValue({
      accountId: TEST_ACCOUNT_ID,
    } as HubSpotConfigAccount);
    mockIsHubSpotHttpError.mockReturnValue(false);
    mockGetProjectConfig.mockResolvedValue({
      projectConfig: createMockProjectConfig(),
      projectDir: TEST_PROJECT_PATH,
    });
    mockValidateProjectConfig.mockImplementation(() => {});
  });

  describe('register', () => {
    it('should register tool with correct parameters', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'get-build-logs',
        expect.objectContaining({
          title: 'Get HubSpot Project Build Logs',
          description: expect.stringContaining(
            'Retrieves build logs for a specific HubSpot project build'
          ),
          inputSchema: expect.anything(),
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
      buildId: TEST_BUILD_ID,
      logLevel: 'ALL' as const,
    };

    describe('error handling', () => {
      it('should return error when account ID cannot be determined', async () => {
        mockGetConfigDefaultAccountIfExists.mockReturnValue(undefined);

        const result = await tool.handler(baseInput);

        expect(result).toEqual({
          content: [
            {
              type: 'text',
              text: TEST_WORKING_DIR,
            },
            {
              type: 'text',
              text: 'No account ID found. Please run `hs account auth` to configure an account, or set a default account with `hs account use <account>`',
            },
          ],
        });
        expect(mockHttpGet).not.toHaveBeenCalled();
      });

      it('should handle HubSpot HTTP errors', async () => {
        const error = new Error('API Error');
        mockIsHubSpotHttpError.mockReturnValue(true);
        mockHttpGet.mockRejectedValue(error);

        const result = await tool.handler(baseInput);

        expectTextContent(result, 'API Error');
      });

      it('should handle generic errors', async () => {
        const error = new Error('Generic error');
        mockIsHubSpotHttpError.mockReturnValue(false);
        mockHttpGet.mockRejectedValue(error);

        const result = await tool.handler(baseInput);

        expectTextContent(result, 'Generic error');
      });

      it('should handle empty logs', async () => {
        const emptyLogsResponse = {
          pipelineStage: 'BUILD',
          pipelineStepId: 2,
          projectName: TEST_PROJECT_NAME,
          logs: [],
        };
        mockHttpGet.mockResolvedValue(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          createLogsResponse(emptyLogsResponse) as any
        );

        const result = await tool.handler(baseInput);

        expectTextContent(
          result,
          `No logs found for build #${TEST_BUILD_ID}`,
          TEST_PROJECT_NAME
        );
      });
    });

    describe('log fetching', () => {
      it('should fetch and display all logs', async () => {
        const mockLogs = createMockLogs();
        mockHttpGet.mockResolvedValue(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          createLogsResponse(mockLogs) as any
        );

        const result = await tool.handler(baseInput);

        expect(mockGetProjectConfig).toHaveBeenCalledWith(TEST_PROJECT_PATH);
        expect(mockHttpGet).toHaveBeenCalledWith(TEST_ACCOUNT_ID, {
          url: `dfs/logging/v1/logs/projects/${TEST_PROJECT_NAME}/builds/${TEST_BUILD_ID}`,
        });

        expectTextContent(
          result,
          `Logs for build #${TEST_BUILD_ID}`,
          TEST_PROJECT_NAME,
          'ALL level',
          'Starting build validation',
          'Successfully validated',
          'Failed to build card',
          'Deprecated API usage'
        );
      });

      it('should filter logs by ERROR level', async () => {
        const mockLogs = createMockLogs();
        mockHttpGet.mockResolvedValue(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          createLogsResponse(mockLogs) as any
        );

        const result = await tool.handler({
          ...baseInput,
          logLevel: 'ERROR',
        });

        expectTextContent(
          result,
          'ERROR level',
          'Failed to build card',
          'preview.png was not found'
        );
        expect(result.content[1].text).not.toContain('Starting build');
        expect(result.content[1].text).not.toContain('Deprecated API');
      });

      it('should filter logs by WARN level', async () => {
        const mockLogs = createMockLogs();
        mockHttpGet.mockResolvedValue(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          createLogsResponse(mockLogs) as any
        );

        const result = await tool.handler({
          ...baseInput,
          logLevel: 'WARN',
        });

        expectTextContent(
          result,
          'WARN level',
          'Deprecated API usage detected'
        );
        expect(result.content[1].text).not.toContain('Starting build');
        expect(result.content[1].text).not.toContain('Failed to build card');
      });

      it('should filter logs by INFO level', async () => {
        const mockLogs = createMockLogs();
        mockHttpGet.mockResolvedValue(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          createLogsResponse(mockLogs) as any
        );

        const result = await tool.handler({
          ...baseInput,
          logLevel: 'INFO',
        });

        expectTextContent(
          result,
          'INFO level',
          'Starting build validation',
          'Successfully validated'
        );
        expect(result.content[1].text).not.toContain('Failed to build card');
        expect(result.content[1].text).not.toContain('Deprecated API');
      });

      it('should show all logs when no logs match filter', async () => {
        const infoOnlyResponse = {
          pipelineStage: 'BUILD',
          pipelineStepId: 2,
          projectName: TEST_PROJECT_NAME,
          logs: [
            {
              pipelineStepId: 2,
              pipelineSubstepId: 'info-only-id',
              pipelineStage: 'BUILD',
              projectName: TEST_PROJECT_NAME,
              logs: [
                createMockLog({
                  logLevel: 'INFO',
                  message: 'Info message only',
                  pipelineSubstepId: 'info-only-id',
                }),
              ],
            },
          ],
        };
        mockHttpGet.mockResolvedValue(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          createLogsResponse(infoOnlyResponse) as any
        );

        const result = await tool.handler({
          ...baseInput,
          logLevel: 'ERROR',
        });

        expectTextContent(
          result,
          `No ERROR level logs found`,
          `build #${TEST_BUILD_ID}`,
          'Showing all logs instead',
          'Info message only'
        );
      });
    });
  });
});

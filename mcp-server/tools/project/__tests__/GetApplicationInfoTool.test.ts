import { GetApplicationInfoTool } from '../GetApplicationInfoTool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../../utils/logger.js';
import { http } from '@hubspot/local-dev-lib/http';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import { MockedFunction, Mocked } from 'vitest';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';
import { discoverAccountTargets } from '../../../../lib/accountTargetDiscovery.js';
import type { AccountTargetCandidate } from '../../../../types/AccountTargets.js';
import { setupHubSpotConfig } from '../../../utils/config.js';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../../utils/logger.js');
vi.mock('@hubspot/local-dev-lib/http');
vi.mock('@hubspot/local-dev-lib/errors/index');
vi.mock('../../../utils/feedbackTracking');
vi.mock('../../../utils/config');
vi.mock('../../../../lib/accountTargetDiscovery.js');

const mockMcpFeedbackRequest = vi.mocked(mcpFeedbackRequest);
const mockedDiscoverAccountTargets = vi.mocked(discoverAccountTargets);
const mockedSetupHubSpotConfig = vi.mocked(setupHubSpotConfig);
const mockHttp = http as Mocked<typeof http>;
const mockIsHubSpotHttpError = isHubSpotHttpError as unknown as MockedFunction<
  typeof isHubSpotHttpError
>;

describe('mcp-server/tools/project/GetApplicationInfoTool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let mockLogger: Mocked<McpLogger>;
  let tool: GetApplicationInfoTool;
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

    tool = new GetApplicationInfoTool(mockMcpServer, mockLogger);
  });

  describe('register', () => {
    it('should register tool with correct parameters', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'get-apps-info',
        expect.objectContaining({
          title: 'Get Apps Information',
          description: expect.stringContaining(
            'Retrieves a list of all HubSpot apps available in the current account'
          ),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function)
      );
      expect(result).toBe(mockRegisteredTool);
    });
  });

  describe('handler', () => {
    const input = { absoluteCurrentWorkingDirectory: '/test/dir' };

    beforeEach(() => {
      mockedDiscoverAccountTargets.mockResolvedValue({
        candidates: [],
        recommended: { accountId: 123456789 } as AccountTargetCandidate,
      });
      mockIsHubSpotHttpError.mockReturnValue(false);
    });

    it('should use absoluteProjectPath for account resolution when provided', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockHttp.get.mockResolvedValue({ data: { applications: [] } } as any);

      await tool.handler({
        absoluteCurrentWorkingDirectory: '/workspace',
        absoluteProjectPath: '/workspace/my-project',
      });

      expect(mockedSetupHubSpotConfig).toHaveBeenCalledWith(
        '/workspace/my-project'
      );
    });

    it('should fall back to absoluteCurrentWorkingDirectory when absoluteProjectPath is not provided', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockHttp.get.mockResolvedValue({ data: { applications: [] } } as any);

      await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
      });

      expect(mockedSetupHubSpotConfig).toHaveBeenCalledWith('/test/dir');
    });

    it('should return application information successfully', async () => {
      const mockResponse = {
        data: {
          applications: [
            {
              appId: 12345,
              appName: 'Test App 1',
            },
            {
              appId: 67890,
              appName: 'Test App 2',
            },
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockHttp.get.mockResolvedValue(mockResponse as any);

      const result = await tool.handler(input);

      expect(mockedDiscoverAccountTargets).toHaveBeenCalledWith();
      expect(mockHttp.get).toHaveBeenCalledWith(123456789, {
        url: 'app/feature/utilization/public/v3/insights/apps',
      });

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockResponse.data, null, 2),
          },
        ],
      });
    });

    it('should return error when account ID cannot be determined', async () => {
      mockedDiscoverAccountTargets.mockResolvedValue({
        candidates: [],
        recommended: undefined,
      });

      const result = await tool.handler(input);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'No account ID found. Call the auth-account tool to authenticate a HubSpot account.',
          },
        ],
      });

      expect(mockHttp.get).not.toHaveBeenCalled();
    });

    it('should handle empty applications response', async () => {
      const mockResponse = {
        data: {
          applications: [],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockHttp.get.mockResolvedValue(mockResponse as any);

      const result = await tool.handler(input);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockResponse.data, null, 2),
          },
        ],
      });
    });
  });
});

import { GetApplicationInfoTool } from '../GetApplicationInfoTool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAccountId } from '@hubspot/local-dev-lib/config';
import { http } from '@hubspot/local-dev-lib/http';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import { MockedFunction, Mocked } from 'vitest';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../utils/toolUsageTracking');
vi.mock('@hubspot/local-dev-lib/http');
vi.mock('@hubspot/local-dev-lib/errors/index');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../../utils/feedbackTracking');

const mockMcpFeedbackRequest = mcpFeedbackRequest as MockedFunction<
  typeof mcpFeedbackRequest
>;

const mockGetAccountId = getAccountId as MockedFunction<typeof getAccountId>;
const mockHttp = http as Mocked<typeof http>;
const mockIsHubSpotHttpError = isHubSpotHttpError as unknown as MockedFunction<
  typeof isHubSpotHttpError
>;

describe('mcp-server/tools/project/GetApplicationInfoTool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let tool: GetApplicationInfoTool;
  let mockRegisteredTool: RegisteredTool;

  beforeEach(() => {
    vi.clearAllMocks();

    // @ts-expect-error Not mocking the whole thing
    mockMcpServer = {
      registerTool: vi.fn(),
    };

    mockRegisteredTool = {} as RegisteredTool;
    mockMcpServer.registerTool.mockReturnValue(mockRegisteredTool);
    mockMcpFeedbackRequest.mockResolvedValue('');

    tool = new GetApplicationInfoTool(mockMcpServer);
  });

  describe('register', () => {
    it('should register tool with correct parameters', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'get-applications-info',
        expect.objectContaining({
          title: 'Get Applications Information',
          description: expect.stringContaining(
            'Retrieves a list of all HubSpot applications available in the current account'
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
      mockGetAccountId.mockReturnValue(123456789);
      mockIsHubSpotHttpError.mockReturnValue(false);
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

      expect(mockGetAccountId).toHaveBeenCalledWith();
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
      mockGetAccountId.mockReturnValue(null);

      const result = await tool.handler(input);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'No account ID found. Please run `hs account auth` to configure an account, or set a default account with `hs account use <account>`',
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

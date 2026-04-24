import { GetApiUsagePatternsByAppIdTool } from '../GetApiUsagePatternsByAppIdTool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../../utils/logger.js';
import { getConfigDefaultAccountIfExists } from '@hubspot/local-dev-lib/config';
import { http } from '@hubspot/local-dev-lib/http';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import { MockedFunction, Mocked } from 'vitest';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../../utils/logger.js');
vi.mock('@hubspot/local-dev-lib/http');
vi.mock('@hubspot/local-dev-lib/errors/index');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../../utils/feedbackTracking');

const mockMcpFeedbackRequest = mcpFeedbackRequest as MockedFunction<
  typeof mcpFeedbackRequest
>;

const mockGetConfigDefaultAccountIfExists =
  getConfigDefaultAccountIfExists as MockedFunction<
    typeof getConfigDefaultAccountIfExists
  >;
const mockHttp = http as Mocked<typeof http>;
const mockIsHubSpotHttpError = isHubSpotHttpError as unknown as MockedFunction<
  typeof isHubSpotHttpError
>;

describe('mcp-server/tools/project/GetApiUsagePatternsByAppIdTool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let mockLogger: Mocked<McpLogger>;
  let tool: GetApiUsagePatternsByAppIdTool;
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

    tool = new GetApiUsagePatternsByAppIdTool(mockMcpServer, mockLogger);
  });

  describe('register', () => {
    it('should register tool with correct parameters', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'get-api-usage-patterns-by-app-id',
        expect.objectContaining({
          title: 'Get API Usage Patterns by App ID',
          description: expect.stringContaining(
            'Retrieves detailed API usage pattern analytics for a specific HubSpot app'
          ),
          inputSchema: expect.objectContaining({
            appId: expect.objectContaining({
              describe: expect.any(Function),
            }),
            startDate: expect.objectContaining({
              optional: expect.any(Function),
            }),
            endDate: expect.objectContaining({
              optional: expect.any(Function),
            }),
          }),
        }),
        expect.any(Function)
      );
      expect(result).toBe(mockRegisteredTool);
    });
  });

  describe('handler', () => {
    const input = {
      absoluteCurrentWorkingDirectory: '/test/dir',
      appId: '12345',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
    };

    beforeEach(() => {
      mockGetConfigDefaultAccountIfExists.mockReturnValue({
        accountId: 123456789,
      } as HubSpotConfigAccount);
      mockIsHubSpotHttpError.mockReturnValue(false);
    });

    it('should return API usage patterns successfully', async () => {
      const mockResponse = {
        data: {
          patternSummaries: {
            additionalProp1: {
              portalPercentage: 25.5,
              numOfPortals: 150,
            },
            additionalProp2: {
              portalPercentage: 18.2,
              numOfPortals: 89,
            },
            additionalProp3: {
              portalPercentage: 32.1,
              numOfPortals: 201,
            },
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockHttp.get.mockResolvedValue(mockResponse as any);

      const result = await tool.handler(input);

      expect(mockGetConfigDefaultAccountIfExists).toHaveBeenCalledWith();
      expect(mockHttp.get).toHaveBeenCalledWith(123456789, {
        url: 'app/feature/utilization/public/v3/insights/app/12345/usage-patterns',
        params: {
          startDate: '2025-01-01',
          endDate: '2025-12-31',
        },
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
      mockGetConfigDefaultAccountIfExists.mockReturnValue(undefined);

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

    it('should handle empty usage patterns response', async () => {
      const mockResponse = {
        data: {
          patternSummaries: {},
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

import { GetApiUsagePatternsByAppIdTool } from '../GetApiUsagePatternsByAppIdTool.js';
import { z } from 'zod';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAccountId } from '@hubspot/local-dev-lib/config';
import { http } from '@hubspot/local-dev-lib/http';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import { MockedFunction, Mocked } from 'vitest';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../../utils/toolUsageTracking');
vi.mock('@hubspot/local-dev-lib/http');
vi.mock('@hubspot/local-dev-lib/errors/index');
vi.mock('@hubspot/local-dev-lib/config');

const mockGetAccountId = getAccountId as MockedFunction<typeof getAccountId>;
const mockHttp = http as Mocked<typeof http>;
const mockIsHubSpotHttpError = isHubSpotHttpError as unknown as MockedFunction<
  typeof isHubSpotHttpError
>;

describe('mcp-server/tools/project/GetApiUsagePatternsByAppIdTool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let tool: GetApiUsagePatternsByAppIdTool;
  let mockRegisteredTool: RegisteredTool;

  beforeEach(() => {
    vi.clearAllMocks();

    // @ts-expect-error Not mocking the whole thing
    mockMcpServer = {
      registerTool: vi.fn(),
    };

    mockRegisteredTool = {} as RegisteredTool;
    mockMcpServer.registerTool.mockReturnValue(mockRegisteredTool);

    tool = new GetApiUsagePatternsByAppIdTool(mockMcpServer);
  });

  describe('register', () => {
    it('should register tool with correct parameters', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'get-api-usage-patterns-by-app-id',
        {
          title: 'Get API Usage Patterns by App ID',
          description:
            'Retrieves detailed API usage pattern analytics for a specific HubSpot application. Requires an appId (string) to identify the target application. Optionally accepts startDate and endDate parameters in YYYY-MM-DD format to filter results within a specific time range. Returns patternSummaries object containing usage statistics including portalPercentage (percentage of portals using this pattern) and numOfPortals (total count of portals) for different usage patterns. This data helps analyze how the application is being used across different HubSpot portals and can inform optimization decisions.',
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
        },
        tool.handler
      );

      expect(result).toBe(mockRegisteredTool);
    });
  });

  describe('input validation', () => {
    const inputSchema = z.object({
      appId: z
        .string()
        .describe('The application ID to get API usage patterns for.'),
      startDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format')
        .optional()
        .describe(
          'Start date for the usage patterns query in ISO 8601 format (e.g., 2025-01-01).'
        ),
      endDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format')
        .optional()
        .describe(
          'End date for the usage patterns query in ISO 8601 format (e.g., 2025-12-31).'
        ),
    });

    it('should validate date format correctly', () => {
      const validInput = {
        appId: '12345',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      };

      const invalidInput = {
        appId: '12345',
        startDate: '2025-1-1',
        endDate: '2025-12-31T00:00:00Z',
      };

      expect(() => inputSchema.parse(validInput)).not.toThrow();
      expect(() => inputSchema.parse(invalidInput)).toThrow();
    });
  });

  describe('handler', () => {
    const input = {
      appId: '12345',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
    };

    beforeEach(() => {
      mockGetAccountId.mockReturnValue(123456789);
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

      expect(mockGetAccountId).toHaveBeenCalledWith();
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

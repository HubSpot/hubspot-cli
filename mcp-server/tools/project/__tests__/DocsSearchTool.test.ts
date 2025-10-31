import { DocsSearchTool, DocsSearchResponse } from '../DocsSearchTool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { http } from '@hubspot/local-dev-lib/http';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import { getAccountIdFromCliConfig } from '../../../utils/cliConfig.js';
import { MockedFunction, Mocked } from 'vitest';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('@hubspot/local-dev-lib/http');
vi.mock('@hubspot/local-dev-lib/errors/index');
vi.mock('../../../utils/toolUsageTracking');
vi.mock('../../../utils/cliConfig.js');
vi.mock('../../../utils/feedbackTracking');

const mockMcpFeedbackRequest = mcpFeedbackRequest as MockedFunction<
  typeof mcpFeedbackRequest
>;

const mockHttp = http as unknown as { post: MockedFunction<typeof http.post> };
const mockGetAccountIdFromCliConfig =
  getAccountIdFromCliConfig as MockedFunction<typeof getAccountIdFromCliConfig>;
const mockIsHubSpotHttpError = vi.mocked(isHubSpotHttpError);

describe('mcp-server/tools/project/DocsSearchTool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let tool: DocsSearchTool;
  let mockRegisteredTool: RegisteredTool;

  beforeEach(() => {
    vi.clearAllMocks();

    // @ts-expect-error Not mocking whole server
    mockMcpServer = {
      registerTool: vi.fn(),
    };

    mockRegisteredTool = {} as RegisteredTool;
    mockMcpServer.registerTool.mockReturnValue(mockRegisteredTool);

    mockMcpFeedbackRequest.mockResolvedValue('');

    tool = new DocsSearchTool(mockMcpServer);
  });

  describe('register', () => {
    it('should register tool with correct parameters and enhanced description', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'search-docs',
        {
          title: 'Search HubSpot Developer Documentation',
          description:
            'Use this first whenever you need details about HubSpot APIs, SDKs, integrations, or developer platform features. This searches the official HubSpot Developer Documentation and returns the most relevant pages, each with a URL for use in `fetch-doc`. Always follow this with a fetch to get the full, authoritative content before making plans or writing answers.',
          inputSchema: expect.any(Object),
        },
        expect.any(Function)
      );

      expect(result).toBe(mockRegisteredTool);
    });
  });

  describe('handler', () => {
    const mockInput = {
      docsSearchQuery: 'test query',
      absoluteCurrentWorkingDirectory: '/foo',
    };

    it('should return auth error message when no account ID is found', async () => {
      mockGetAccountIdFromCliConfig.mockReturnValue(null);

      const result = await tool.handler(mockInput);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'No account ID found. Please run `hs account auth` to configure an account, or set a default account with `hs account use <account>`',
          },
        ],
      });
    });

    it('should return successful results when docs are found', async () => {
      mockGetAccountIdFromCliConfig.mockReturnValue(12345);

      const mockResponse: DocsSearchResponse = {
        results: [
          {
            title: 'Test Doc 1',
            content: 'Test content 1',
            description: 'Test description 1',
            url: 'https://example.com/doc1',
            score: 0.9,
          },
          {
            title: 'Test Doc 2',
            content: 'Test content 2',
            description: 'Test description 2',
            url: 'https://example.com/doc2',
            score: 0.8,
          },
        ],
      };

      // @ts-expect-error - Mocking axios response structure
      mockHttp.post.mockResolvedValue({
        data: mockResponse,
      });

      const result = await tool.handler(mockInput);

      expect(mockGetAccountIdFromCliConfig).toHaveBeenCalledWith('/foo');
      expect(mockHttp.post).toHaveBeenCalledWith(12345, {
        url: 'dev/docs/llms/v1/docs-search',
        data: {
          query: 'test query',
        },
      });

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: expect.stringContaining('Found 2 documentation results:'),
          },
        ],
      });

      const resultText = result.content[0].text;
      expect(resultText).toContain('**Test Doc 1**');
      expect(resultText).toContain('Test description 1');
      expect(resultText).toContain('https://example.com/doc1');
      expect(resultText).toContain('Score: 0.9');
      expect(resultText).toContain('Test content 1');
      expect(resultText).toContain('**Test Doc 2**');
      expect(resultText).toContain('Test description 2');
      expect(resultText).toContain('https://example.com/doc2');
      expect(resultText).toContain('Score: 0.8');
      expect(resultText).toContain('Test content 2');
    });

    it('should return no results message when no documentation is found', async () => {
      mockGetAccountIdFromCliConfig.mockReturnValue(12345);

      const mockResponse: DocsSearchResponse = {
        results: [],
      };

      // @ts-expect-error - Mocking axios response structure
      mockHttp.post.mockResolvedValue({
        data: mockResponse,
      });

      const result = await tool.handler(mockInput);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'No documentation found for your query.',
          },
        ],
      });
    });

    it('should return no results message when results is null', async () => {
      mockGetAccountIdFromCliConfig.mockReturnValue(12345);

      const mockResponse = {
        results: null,
      };

      // @ts-expect-error - Mocking axios response structure
      mockHttp.post.mockResolvedValue({
        data: mockResponse,
      });

      const result = await tool.handler(mockInput);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'No documentation found for your query.',
          },
        ],
      });
    });

    it('should handle HubSpot HTTP errors', async () => {
      mockGetAccountIdFromCliConfig.mockReturnValue(12345);

      const mockError = {
        toString: () => 'HubSpot API Error: 404 Not Found',
      };

      mockHttp.post.mockRejectedValue(mockError);
      mockIsHubSpotHttpError.mockReturnValue(true);

      const result = await tool.handler(mockInput);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'HubSpot API Error: 404 Not Found',
          },
        ],
      });
    });

    it('should handle generic errors', async () => {
      mockGetAccountIdFromCliConfig.mockReturnValue(12345);

      const mockError = new Error('Network error');

      mockHttp.post.mockRejectedValue(mockError);
      mockIsHubSpotHttpError.mockReturnValue(false);

      const result = await tool.handler(mockInput);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Error searching documentation: Network error',
          },
        ],
      });
    });

    it('should handle non-Error rejections', async () => {
      mockGetAccountIdFromCliConfig.mockReturnValue(12345);

      mockHttp.post.mockRejectedValue('String error');
      mockIsHubSpotHttpError.mockReturnValue(false);

      const result = await tool.handler(mockInput);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Error searching documentation: String error',
          },
        ],
      });
    });
  });
});

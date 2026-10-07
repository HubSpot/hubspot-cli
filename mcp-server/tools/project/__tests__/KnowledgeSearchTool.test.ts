import {
  KnowledgeSearchTool,
  KnowledgeSearchResponse,
} from '../KnowledgeSearchTool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../../utils/logger.js';
import { http } from '@hubspot/local-dev-lib/http/unauthed';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import { MockedFunction } from 'vitest';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../../utils/logger.js');
vi.mock('@hubspot/local-dev-lib/http/unauthed');
vi.mock('@hubspot/local-dev-lib/errors/index');
vi.mock('../../../utils/feedbackTracking');
vi.mock('../../../utils/config.js');

const mockMcpFeedbackRequest = vi.mocked(mcpFeedbackRequest);
const mockHttp = http as unknown as { get: MockedFunction<typeof http.get> };
const mockIsHubSpotHttpError = vi.mocked(isHubSpotHttpError);

const EXPECTED_URL =
  'https://api.hubapi.com/contentsearch/v2/search?term=test+query&type=BLOG_POST&domain=knowledge.hubspot.com&portalId=53&limit=5';

describe('mcp-server/tools/project/KnowledgeSearchTool', () => {
  let mockMcpServer: ReturnType<typeof vi.mocked<McpServer>>;
  let mockLogger: ReturnType<typeof vi.mocked<McpLogger>>;
  let tool: KnowledgeSearchTool;
  let mockRegisteredTool: RegisteredTool;

  beforeEach(() => {
    // @ts-expect-error Not mocking whole server
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

    tool = new KnowledgeSearchTool(mockMcpServer, mockLogger);
  });

  describe('register', () => {
    it('should register tool with correct parameters and description', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'search-knowledge-base',
        expect.objectContaining({
          title: 'Search HubSpot Knowledge Base',
          description:
            'Do not use this to find whether a developer API or feature is available on a subscription tier or plan (for example "is the content audit API available on Content Hub Professional"). Use `search-docs` then `fetch-doc` for that. Use this only for how-to guidance on using HubSpot products and features, and for account or subscription settings. This searches the HubSpot Knowledge Base (knowledge.hubspot.com) and returns the most relevant help articles, each with a URL.',
          inputSchema: expect.any(Object),
        }),
        expect.any(Function)
      );

      expect(result).toBe(mockRegisteredTool);
    });
  });

  describe('handler', () => {
    const mockInput = {
      knowledgeSearchQuery: 'test query',
      knowledgeSearchLimit: 5,
      absoluteCurrentWorkingDirectory: '/foo',
    };

    it('should query the knowledge base domain on the HubSpot portal', async () => {
      const mockResponse: KnowledgeSearchResponse = {
        total: 1,
        results: [
          {
            title: 'Create workflows',
            description: 'How to create a workflow.',
            url: 'https://knowledge.hubspot.com/workflows/create-workflows',
            score: 40,
          },
        ],
      };

      // @ts-expect-error - Mocking axios response structure
      mockHttp.get.mockResolvedValue({ data: mockResponse });

      await tool.handler(mockInput);

      expect(mockHttp.get).toHaveBeenCalledWith({ url: EXPECTED_URL });
    });

    it('should return formatted results when articles are found', async () => {
      const mockResponse: KnowledgeSearchResponse = {
        total: 2,
        results: [
          {
            title: 'Create workflows',
            description: 'How to create a workflow.',
            url: 'https://knowledge.hubspot.com/workflows/create-workflows',
            score: 40,
          },
          {
            title: 'Enrollment triggers',
            description: 'How triggers work.',
            url: 'https://knowledge.hubspot.com/workflows/triggers',
            score: 30,
          },
        ],
      };

      // @ts-expect-error - Mocking axios response structure
      mockHttp.get.mockResolvedValue({ data: mockResponse });

      const result = await tool.handler(mockInput);

      const text = result.content[0].text;
      expect(text).toContain('Found 2 results, showing top 2:');
      expect(text).toContain('**Create workflows**');
      expect(text).toContain('How to create a workflow.');
      expect(text).toContain(
        'URL: https://knowledge.hubspot.com/workflows/create-workflows'
      );
      expect(text).toContain('Score: 40');
      expect(text).toContain('**Enrollment triggers**');
    });

    it('should pass the requested limit to the search request', async () => {
      // @ts-expect-error - Mocking axios response structure
      mockHttp.get.mockResolvedValue({ data: { total: 0, results: [] } });

      await tool.handler({ ...mockInput, knowledgeSearchLimit: 3 });

      expect(mockHttp.get).toHaveBeenCalledWith({
        url: expect.stringContaining('limit=3'),
      });
    });

    it('should return a no results message when nothing is found', async () => {
      const mockResponse: KnowledgeSearchResponse = { total: 0, results: [] };

      // @ts-expect-error - Mocking axios response structure
      mockHttp.get.mockResolvedValue({ data: mockResponse });

      const result = await tool.handler(mockInput);

      expect(result.content[0].text).toBe(
        'No knowledge base articles found for your query.'
      );
    });

    it('should append a routing hint that redirects tier questions to the docs', async () => {
      const mockResponse: KnowledgeSearchResponse = {
        total: 1,
        results: [
          {
            title: 'Create workflows',
            description: 'How to create a workflow.',
            url: 'https://knowledge.hubspot.com/workflows/create-workflows',
            score: 40,
          },
        ],
      };

      // @ts-expect-error - Mocking axios response structure
      mockHttp.get.mockResolvedValue({ data: mockResponse });

      const result = await tool.handler(mockInput);

      const hint = result.content.find(c =>
        c.text.includes('use search-docs then fetch-doc')
      );
      expect(hint).toBeDefined();
    });

    it('should handle HubSpot HTTP errors', async () => {
      const mockError = {
        toString: () => 'HubSpot API Error: 404 Not Found',
      };

      mockHttp.get.mockRejectedValue(mockError);
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
      const mockError = new Error('Network error');

      mockHttp.get.mockRejectedValue(mockError);
      mockIsHubSpotHttpError.mockReturnValue(false);

      const result = await tool.handler(mockInput);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Error searching the knowledge base: Network error',
          },
        ],
      });
    });
  });
});

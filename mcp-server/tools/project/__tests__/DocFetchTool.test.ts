import { DocFetchTool } from '../DocFetchTool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { http } from '@hubspot/local-dev-lib/http/unauthed';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import { MockedFunction, Mocked } from 'vitest';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('@hubspot/local-dev-lib/http/unauthed');
vi.mock('@hubspot/local-dev-lib/errors/index');
vi.mock('../../utils/toolUsageTracking');
vi.mock('../../../utils/feedbackTracking');

const mockMcpFeedbackRequest = mcpFeedbackRequest as MockedFunction<
  typeof mcpFeedbackRequest
>;

const mockHttp = http as unknown as { get: MockedFunction<typeof http.get> };
const mockIsHubSpotHttpError = vi.mocked(isHubSpotHttpError);

describe('mcp-server/tools/project/DocFetchTool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let tool: DocFetchTool;
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

    tool = new DocFetchTool(mockMcpServer);
  });

  describe('register', () => {
    it('should register tool with correct parameters', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'fetch-doc',
        expect.objectContaining({
          title: 'Fetch HubSpot Developer Documentation (single file)',
          description: expect.stringContaining(
            'Always use this immediately after `search-docs`'
          ),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function)
      );
      expect(result).toBe(mockRegisteredTool);
    });
  });

  describe('handler', () => {
    const mockInput = {
      absoluteCurrentWorkingDirectory: '/test/dir',
      docUrl: 'https://example.com/docs/test-doc',
    };

    it('should successfully fetch and return markdown content', async () => {
      const mockContent =
        '# Test Document\n\nThis is a test markdown document.';

      // @ts-expect-error - Mocking axios response structure
      mockHttp.get.mockResolvedValue({
        data: mockContent,
      });

      const result = await tool.handler(mockInput);

      expect(mockHttp.get).toHaveBeenCalledWith({
        url: 'https://example.com/docs/test-doc.md',
      });

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: mockContent,
          },
        ],
      });
    });

    it('should handle HubSpot HTTP errors', async () => {
      const mockError = {
        toString: () =>
          'HubSpotHttpError: \n- message: The request was not found.\n- status: 404\n- statusText: Not Found\n- method: get\n- code: ERR_BAD_REQUEST\n- derivedContext: {\n  "request": "https://example.com/docs/test-doc.md"\n}',
      };

      mockHttp.get.mockRejectedValue(mockError);
      mockIsHubSpotHttpError.mockReturnValue(true);

      const result = await tool.handler(mockInput);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'HubSpotHttpError: \n- message: The request was not found.\n- status: 404\n- statusText: Not Found\n- method: get\n- code: ERR_BAD_REQUEST\n- derivedContext: {\n  "request": "https://example.com/docs/test-doc.md"\n}',
          },
        ],
      });
    });

    it('should handle empty content', async () => {
      // @ts-expect-error - Mocking axios response structure
      mockHttp.get.mockResolvedValue({
        data: '   ',
      });

      const result = await tool.handler(mockInput);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Document is empty or contains no content.',
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
            text: 'Error fetching documentation: Network error',
          },
        ],
      });
    });

    it('should handle non-Error rejections', async () => {
      mockHttp.get.mockRejectedValue('String error');
      mockIsHubSpotHttpError.mockReturnValue(false);

      const result = await tool.handler(mockInput);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Error fetching documentation: String error',
          },
        ],
      });
    });
  });
});

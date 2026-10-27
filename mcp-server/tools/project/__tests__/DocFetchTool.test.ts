import { DocFetchTool } from '../DocFetchTool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../../utils/logger.js';
import { http } from '@hubspot/local-dev-lib/http/unauthed';
import { MockedFunction, Mocked } from 'vitest';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';
import { mockHubSpotHttpError } from '../../../../lib/testUtils.js';
import { getToolErrorMessage } from '../../../utils/errors.js';
import { getConfigCredentials } from '../../../../lib/accountCredentials.js';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../../utils/logger.js');
vi.mock('@hubspot/local-dev-lib/http/unauthed');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../../utils/feedbackTracking');
vi.mock('../../../../lib/accountCredentials.js');

const mockMcpFeedbackRequest = mcpFeedbackRequest as MockedFunction<
  typeof mcpFeedbackRequest
>;

const mockHttp = http as unknown as { get: MockedFunction<typeof http.get> };
const mockGetConfigCredentials = vi.mocked(getConfigCredentials);

describe('mcp-server/tools/project/DocFetchTool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let mockLogger: Mocked<McpLogger>;
  let tool: DocFetchTool;
  let mockRegisteredTool: RegisteredTool;

  beforeEach(() => {
    mockGetConfigCredentials.mockReturnValue([]);
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

    tool = new DocFetchTool(mockMcpServer, mockLogger);
  });

  describe('register', () => {
    it('should register tool with correct parameters', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'fetch-doc',
        expect.objectContaining({
          title: 'Fetch HubSpot Developer Documentation (single file)',
          description: expect.stringContaining(
            'stated plainly (for example "requires Content Hub Enterprise") rather than by quoting raw spec fields.'
          ),
          inputSchema: expect.any(Object),
          outputSchema: expect.any(Object),
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
      offset: 0,
      maxCharacters: 20000,
      fullDocument: false,
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
        structuredContent: {
          text: mockContent,
          offset: 0,
          totalCharacters: mockContent.length,
        },
      });
    });

    it('should return content that includes a Supported products block unchanged', async () => {
      const mockContent =
        '# CMS content audit API\n\n<SupportedProducts cms={true} cmsLevel="enterprise" />\n\nThe CMS content audit API allows you to query audit logs.';

      // @ts-expect-error - Mocking axios response structure
      mockHttp.get.mockResolvedValue({ data: mockContent });

      const result = await tool.handler(mockInput);

      expect(result.content[0].text).toBe(mockContent);
    });

    it('should redact config credentials from HubSpot HTTP errors', async () => {
      const mockError = mockHubSpotHttpError(
        'Unauthorized',
        { status: 401, data: { message: 'The access key is missing scopes.' } },
        {
          url: 'localdevauth/v1/auth/refresh',
          data: '{"encodedOAuthRefreshToken":"pak-secret"}',
        }
      );
      mockGetConfigCredentials.mockReturnValue(['pak-secret']);

      mockHttp.get.mockRejectedValue(mockError);

      const result = await tool.handler(mockInput);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: `Error fetching documentation: ${getToolErrorMessage(mockError)}`,
          },
        ],
        isError: true,
      });
      expect(JSON.stringify(result)).not.toContain('pak-secret');
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
        isError: true,
      });
    });

    it('should handle generic errors', async () => {
      const mockError = new Error('Network error');

      mockHttp.get.mockRejectedValue(mockError);

      const result = await tool.handler(mockInput);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Error fetching documentation: Network error',
          },
        ],
        isError: true,
      });
    });

    it('should handle non-Error rejections', async () => {
      mockHttp.get.mockRejectedValue('String error');

      const result = await tool.handler(mockInput);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Error fetching documentation: String error',
          },
        ],
        isError: true,
      });
    });

    describe('bounded fetch', () => {
      const longContent = Array.from({ length: 25 }, (_, index) =>
        `Line ${index}.`.padEnd(99, '.')
      ).join('\n');

      const boundedInput = { ...mockInput, maxCharacters: 1050 };

      it('should return maxCharacters from the start and give the offset for the next part', async () => {
        // @ts-expect-error - Mocking axios response structure
        mockHttp.get.mockResolvedValue({ data: longContent });

        const result = await tool.handler(boundedInput);

        const chunkEnd = boundedInput.maxCharacters;
        expect(result).toEqual({
          content: [
            { type: 'text', text: longContent.slice(0, chunkEnd) },
            {
              type: 'text',
              text: `This is part of the document (characters 0 to ${chunkEnd} of ${longContent.length}). More content is available. To read the next part, call fetch-doc again with the same arguments and offset set to ${chunkEnd}.`,
            },
          ],
          structuredContent: {
            text: longContent.slice(0, chunkEnd),
            offset: 0,
            nextOffset: chunkEnd,
            totalCharacters: longContent.length,
          },
        });
      });

      it('should return the rest of the document from the offset without a note', async () => {
        // @ts-expect-error - Mocking axios response structure
        mockHttp.get.mockResolvedValue({ data: longContent });

        const offset = longContent.indexOf('Line 20.');
        const result = await tool.handler({ ...boundedInput, offset });

        expect(result).toEqual({
          content: [{ type: 'text', text: longContent.slice(offset) }],
          structuredContent: {
            text: longContent.slice(offset),
            offset,
            totalCharacters: longContent.length,
          },
        });
      });

      it('should return the whole document when fullDocument is true', async () => {
        // @ts-expect-error - Mocking axios response structure
        mockHttp.get.mockResolvedValue({ data: longContent });

        const result = await tool.handler({
          ...boundedInput,
          fullDocument: true,
        });

        expect(result).toEqual({
          content: [{ type: 'text', text: longContent }],
          structuredContent: {
            text: longContent,
            offset: 0,
            totalCharacters: longContent.length,
          },
        });
      });

      it('should return an error when the offset is past the end', async () => {
        // @ts-expect-error - Mocking axios response structure
        mockHttp.get.mockResolvedValue({ data: longContent });

        const result = await tool.handler({ ...boundedInput, offset: 5000 });

        expect(result).toEqual({
          content: [
            {
              type: 'text',
              text: `Offset 5000 is past the end of the document, which has ${longContent.length} characters.`,
            },
          ],
          isError: true,
        });
      });
    });
  });
});

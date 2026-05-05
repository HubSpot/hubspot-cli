import { FindProjectsTool } from '../FindProjectsTool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../../utils/logger.js';
import { walk } from '@hubspot/local-dev-lib/fs';
import { MockedFunction, Mocked } from 'vitest';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../../utils/logger.js');
vi.mock('../../../utils/feedbackTracking');
vi.mock('@hubspot/local-dev-lib/fs');

const mockMcpFeedbackRequest = mcpFeedbackRequest as MockedFunction<
  typeof mcpFeedbackRequest
>;
const mockWalk = walk as MockedFunction<typeof walk>;

describe('mcp-server/tools/project/FindProjectsTool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let mockLogger: Mocked<McpLogger>;
  let tool: FindProjectsTool;
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

    tool = new FindProjectsTool(mockMcpServer, mockLogger);
  });

  describe('register', () => {
    it('should register tool with correct parameters', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'find-projects',
        expect.objectContaining({
          title: 'Find HubSpot Projects',
          description: expect.stringContaining('hsproject.json'),
          inputSchema: expect.any(Object),
          annotations: expect.objectContaining({
            readOnlyHint: true,
            idempotentHint: true,
          }),
        }),
        expect.any(Function)
      );
      expect(result).toBe(mockRegisteredTool);
    });
  });

  describe('handler', () => {
    const baseInput = {
      absoluteDirectory: '/test/workspace',
    };

    it('should return project paths when projects are found', async () => {
      mockWalk.mockResolvedValue([
        '/test/workspace/project-a/hsproject.json',
        '/test/workspace/project-b/src/hsproject.json',
      ]);

      const result = await tool.handler(baseInput);

      expect(mockWalk).toHaveBeenCalledWith('/test/workspace', [
        'node_modules',
        '.git',
        '.vite',
      ]);
      expect(result.content[0].text).toContain('Found 2 project(s):');
      expect(result.content[0].text).toContain('/test/workspace/project-a');
      expect(result.content[0].text).toContain('/test/workspace/project-b/src');
    });

    it('should return a message when no projects are found', async () => {
      mockWalk.mockResolvedValue([
        '/test/workspace/README.md',
        '/test/workspace/package.json',
      ]);

      const result = await tool.handler(baseInput);

      expect(result.content[0].text).toContain(
        'No hsproject.json files found under /test/workspace'
      );
    });

    it('should return a message when directory is empty', async () => {
      mockWalk.mockResolvedValue([]);

      const result = await tool.handler(baseInput);

      expect(result.content[0].text).toContain('No hsproject.json files found');
    });

    it('should handle walk errors gracefully', async () => {
      mockWalk.mockRejectedValue(new Error('ENOENT: no such directory'));

      const result = await tool.handler(baseInput);

      expect(result.content[0].text).toContain(
        'Error searching for projects: ENOENT: no such directory'
      );
    });

    it('should surface cause from FileSystemError with empty message', async () => {
      const cause = new Error(
        "ENOENT: no such file or directory, lstat '/test/workspace'"
      );
      const fileSystemError = new Error('', { cause });

      mockWalk.mockRejectedValue(fileSystemError);

      const result = await tool.handler(baseInput);

      expect(result.content[0].text).toContain(
        'Error searching for projects: FileSystemError: ENOENT: no such file or directory'
      );
    });

    it('should handle non-Error thrown values', async () => {
      mockWalk.mockRejectedValue('permission denied');

      const result = await tool.handler(baseInput);

      expect(result.content[0].text).toContain(
        'Error searching for projects: permission denied'
      );
    });

    it('should filter only hsproject.json files from walk results', async () => {
      mockWalk.mockResolvedValue([
        '/test/workspace/project-a/hsproject.json',
        '/test/workspace/project-a/package.json',
        '/test/workspace/project-a/src/index.ts',
        '/test/workspace/other/config.json',
      ]);

      const result = await tool.handler(baseInput);

      expect(result.content[0].text).toContain('Found 1 project(s):');
      expect(result.content[0].text).toContain('/test/workspace/project-a');
      expect(result.content[0].text).not.toContain('other');
    });

    it('should log debug message when handler catches an error', async () => {
      mockWalk.mockRejectedValue(new Error('ENOENT: no such directory'));

      await tool.handler(baseInput);

      expect(mockLogger.debug).toHaveBeenCalledWith('find-projects', {
        message: 'Handler caught error',
        error: 'ENOENT: no such directory',
      });
    });
  });
});

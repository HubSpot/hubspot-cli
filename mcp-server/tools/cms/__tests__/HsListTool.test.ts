import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HsListTool } from '../HsListTool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { runCommandInDir } from '../../../utils/project.js';
import { addFlag } from '../../../utils/command.js';
import { MockedFunction, Mocked } from 'vitest';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../../utils/project');
vi.mock('../../../utils/command');
vi.mock('../../../utils/toolUsageTracking', () => ({
  trackToolUsage: vi.fn(),
}));
vi.mock('../../../utils/feedbackTracking');

const mockMcpFeedbackRequest = mcpFeedbackRequest as MockedFunction<
  typeof mcpFeedbackRequest
>;

const mockRunCommandInDir = runCommandInDir as MockedFunction<
  typeof runCommandInDir
>;
const mockAddFlag = addFlag as MockedFunction<typeof addFlag>;

describe('HsListTool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let tool: HsListTool;
  let mockRegisteredTool: RegisteredTool;

  beforeEach(() => {
    vi.clearAllMocks();

    // @ts-expect-error Not mocking the whole server
    mockMcpServer = {
      registerTool: vi.fn(),
    };

    mockRegisteredTool = {} as RegisteredTool;
    mockMcpServer.registerTool.mockReturnValue(mockRegisteredTool);
    mockMcpFeedbackRequest.mockResolvedValue('');

    tool = new HsListTool(mockMcpServer);
  });

  describe('register', () => {
    it('should register the tool with the MCP server', () => {
      const result = tool.register();

      // First assertion - verify original description
      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'list-cms-remote-contents',
        expect.objectContaining({
          title: 'List HubSpot CMS Directory Contents',
          description: expect.stringContaining(
            'List remote contents of a HubSpot CMS directory'
          ),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function)
      );
      expect(result).toBe(mockRegisteredTool);
    });
  });

  describe('handler', () => {
    it('should execute hs list command with no parameters', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'file1.html\nfile2.js\nfolder/',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
      });

      expect(mockRunCommandInDir).toHaveBeenCalledWith('/test/dir', 'hs list');
      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('file1.html\nfile2.js\nfolder/');
      expect(result.content[1].text).toBe('');
    });

    it('should execute hs list command with path parameter', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'nested-file.html',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        path: '/my-modules',
      });

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        'hs list /my-modules'
      );
      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('nested-file.html');
      expect(result.content[1].text).toBe('');
    });

    it('should execute hs list command with account parameter', async () => {
      mockAddFlag.mockReturnValue('hs list --account test-account');
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'account-specific-files.html',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        account: 'test-account',
      });

      expect(mockAddFlag).toHaveBeenCalledWith(
        'hs list',
        'account',
        'test-account'
      );
      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        'hs list --account test-account'
      );
      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('account-specific-files.html');
      expect(result.content[1].text).toBe('');
    });

    it('should execute hs list command with both path and account parameters', async () => {
      mockAddFlag.mockReturnValue('hs list /my-path --account test-account');
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'path-and-account-files.html',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        path: '/my-path',
        account: 'test-account',
      });

      expect(mockAddFlag).toHaveBeenCalledWith(
        'hs list /my-path',
        'account',
        'test-account'
      );
      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        'hs list /my-path --account test-account'
      );
      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('path-and-account-files.html');
      expect(result.content[1].text).toBe('');
    });

    it('should handle command execution errors', async () => {
      mockRunCommandInDir.mockRejectedValue(new Error('Command failed'));

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain(
        'Error executing hs list command: Command failed'
      );
    });

    it('should handle stderr output', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'file1.html',
        stderr: 'Warning: Some warning message',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
      });

      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('file1.html');
      expect(result.content[1].text).toContain('Warning: Some warning message');
    });
  });
});

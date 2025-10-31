import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HsFunctionLogsTool } from '../HsFunctionLogsTool.js';
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

describe('HsFunctionLogsTool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let tool: HsFunctionLogsTool;
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

    tool = new HsFunctionLogsTool(mockMcpServer);
  });

  describe('register', () => {
    it('should register the tool with the MCP server', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'get-cms-serverless-function-logs',
        expect.objectContaining({
          title: 'Get HubSpot CMS serverless function logs for an endpoint',
          description: expect.stringContaining(
            'Retrieve logs for HubSpot CMS serverless functions'
          ),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function)
      );
      expect(result).toBe(mockRegisteredTool);
    });
  });

  describe('handler', () => {
    it('should execute basic hs logs command with endpoint', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: '2023-01-01 10:00:00 INFO Function executed successfully',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        endpoint: 'my-function',
      });

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        'hs logs my-function'
      );
      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain(
        'Function executed successfully'
      );
      expect(result.content[1].text).toBe('');
    });

    it('should strip leading slash from endpoint', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: '2023-01-01 10:00:00 INFO Function executed successfully',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        endpoint: '/api/my-endpoint',
      });

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        'hs logs api/my-endpoint'
      );
      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain(
        'Function executed successfully'
      );
      expect(result.content[1].text).toBe('');
    });

    it('should execute hs logs command with latest flag', async () => {
      mockAddFlag.mockReturnValue('hs logs my-endpoint --latest');
      mockRunCommandInDir.mockResolvedValue({
        stdout: '2023-01-01 10:00:00 INFO Latest log entry',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        endpoint: 'my-endpoint',
        latest: true,
      });

      expect(mockAddFlag).toHaveBeenCalledWith(
        'hs logs my-endpoint',
        'latest',
        true
      );
      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        'hs logs my-endpoint --latest'
      );
      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('Latest log entry');
      expect(result.content[1].text).toBe('');
    });

    it('should execute hs logs command with compact flag', async () => {
      mockAddFlag.mockReturnValue('hs logs my-endpoint --compact');
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'compact log output',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        endpoint: 'my-endpoint',
        compact: true,
      });

      expect(mockAddFlag).toHaveBeenCalledWith(
        'hs logs my-endpoint',
        'compact',
        true
      );
      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        'hs logs my-endpoint --compact'
      );
      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('compact log output');
      expect(result.content[1].text).toBe('');
    });

    it('should execute hs logs command with limit parameter', async () => {
      mockAddFlag.mockReturnValue('hs logs my-endpoint --limit 10');
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'limited log entries',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        endpoint: 'my-endpoint',
        limit: 10,
      });

      expect(mockAddFlag).toHaveBeenCalledWith(
        'hs logs my-endpoint',
        'limit',
        10
      );
      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        'hs logs my-endpoint --limit 10'
      );
      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('limited log entries');
      expect(result.content[1].text).toBe('');
    });

    it('should execute hs logs command with account parameter', async () => {
      mockAddFlag.mockReturnValue('hs logs my-endpoint --account test-account');
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'account-specific logs',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        endpoint: 'my-endpoint',
        account: 'test-account',
      });

      expect(mockAddFlag).toHaveBeenCalledWith(
        'hs logs my-endpoint',
        'account',
        'test-account'
      );
      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        'hs logs my-endpoint --account test-account'
      );
      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('account-specific logs');
      expect(result.content[1].text).toBe('');
    });

    it('should execute hs logs command with multiple parameters', async () => {
      mockAddFlag
        .mockReturnValueOnce('hs logs my-endpoint --latest')
        .mockReturnValueOnce('hs logs my-endpoint --latest --compact')
        .mockReturnValueOnce(
          'hs logs my-endpoint --latest --compact --account test-account'
        );
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'latest compact logs',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        endpoint: 'my-endpoint',
        latest: true,
        compact: true,
        account: 'test-account',
      });

      expect(mockAddFlag).toHaveBeenCalledTimes(3);
      expect(mockAddFlag).toHaveBeenNthCalledWith(
        1,
        'hs logs my-endpoint',
        'latest',
        true
      );
      expect(mockAddFlag).toHaveBeenNthCalledWith(
        2,
        'hs logs my-endpoint --latest',
        'compact',
        true
      );
      expect(mockAddFlag).toHaveBeenNthCalledWith(
        3,
        'hs logs my-endpoint --latest --compact',
        'account',
        'test-account'
      );
      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        'hs logs my-endpoint --latest --compact --account test-account'
      );
      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('latest compact logs');
      expect(result.content[1].text).toBe('');
    });

    it('should handle command execution errors', async () => {
      mockRunCommandInDir.mockRejectedValue(new Error('Function not found'));

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        endpoint: 'non-existent-function',
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain(
        'Error executing hs logs command: Function not found'
      );
    });

    it('should handle stderr output', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'function logs',
        stderr: 'Warning: Function may be slow to respond',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        endpoint: 'slow-function',
      });

      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('function logs');
      expect(result.content[1].text).toContain(
        'Warning: Function may be slow to respond'
      );
    });
  });
});

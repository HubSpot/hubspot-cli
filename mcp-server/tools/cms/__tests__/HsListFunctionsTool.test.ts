import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HsListFunctionsTool } from '../HsListFunctionsTool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { runCommandInDir } from '../../../utils/project.js';
import { addFlag } from '../../../utils/command.js';
import { MockedFunction, Mocked } from 'vitest';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../../utils/project');
vi.mock('../../../utils/command');
vi.mock('../../../utils/toolUsageTracking', () => ({
  trackToolUsage: vi.fn(),
}));

const mockRunCommandInDir = runCommandInDir as MockedFunction<
  typeof runCommandInDir
>;
const mockAddFlag = addFlag as MockedFunction<typeof addFlag>;

describe('HsListFunctionsTool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let tool: HsListFunctionsTool;
  let mockRegisteredTool: RegisteredTool;

  beforeEach(() => {
    vi.clearAllMocks();

    // @ts-expect-error Not mocking the whole server
    mockMcpServer = {
      registerTool: vi.fn(),
    };

    mockRegisteredTool = {} as RegisteredTool;
    mockMcpServer.registerTool.mockReturnValue(mockRegisteredTool);

    tool = new HsListFunctionsTool(mockMcpServer);
  });

  describe('register', () => {
    it('should register the tool with the MCP server', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'list-cms-serverless-functions',
        {
          title: 'List HubSpot CMS Serverless Functions',
          description:
            'Get a list of all serverless functions deployed in a HubSpot portal/account. Shows function routes, HTTP methods, secrets, and timestamps.',
          inputSchema: expect.any(Object),
        },
        expect.any(Function)
      );

      expect(result).toBe(mockRegisteredTool);
    });
  });

  describe('handler', () => {
    it('should execute hs function list command with no parameters', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout:
          'Route | Method | Secrets | Created | Updated\n/api/test | GET | | 2023-01-01 | 2023-01-01',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
      });

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        'hs function list'
      );
      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('Route | Method | Secrets');
      expect(result.content[1].text).toBe('');
    });

    it('should execute hs function list command with json flag', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: '[{"route": "/api/test", "method": "GET"}]',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        json: true,
      });

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        'hs function list --json'
      );
      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('[{"route": "/api/test"');
      expect(result.content[1].text).toBe('');
    });

    it('should execute hs function list command with account parameter', async () => {
      mockAddFlag.mockReturnValue('hs function list --account test-account');
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'account-specific-functions',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        account: 'test-account',
      });

      expect(mockAddFlag).toHaveBeenCalledWith(
        'hs function list',
        'account',
        'test-account'
      );
      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        'hs function list --account test-account'
      );
      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('account-specific-functions');
      expect(result.content[1].text).toBe('');
    });

    it('should execute hs function list command with both json and account parameters', async () => {
      mockAddFlag.mockReturnValue(
        'hs function list --json --account test-account'
      );
      mockRunCommandInDir.mockResolvedValue({
        stdout: '[{"route": "/api/test"}]',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        json: true,
        account: 'test-account',
      });

      expect(mockAddFlag).toHaveBeenCalledWith(
        'hs function list --json',
        'account',
        'test-account'
      );
      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        'hs function list --json --account test-account'
      );
      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('[{"route": "/api/test"}]');
      expect(result.content[1].text).toBe('');
    });

    it('should handle command execution errors', async () => {
      mockRunCommandInDir.mockRejectedValue(new Error('Command failed'));

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain(
        'Error executing hs function list command: Command failed'
      );
    });

    it('should handle stderr output', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Route | Method | Secrets\n/api/test | GET |',
        stderr: 'Warning: Some warning message',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
      });

      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('/api/test | GET');
      expect(result.content[1].text).toContain('Warning: Some warning message');
    });
  });
});

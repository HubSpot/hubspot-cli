import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HsFunctionLogsTool } from '../HsFunctionLogsTool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../../utils/logger.js';
import { runCommandInDir } from '../../../utils/command.js';
import { MockedFunction, Mocked } from 'vitest';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';
import { getRoutes } from '@hubspot/local-dev-lib/api/functions';
import { discoverAccountTargets } from '../../../../lib/accountTargetDiscovery.js';
import type { AccountTargetCandidate } from '../../../../types/AccountTargets.js';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../../utils/logger.js');
vi.mock('../../../utils/command', async importOriginal => {
  const mod =
    await importOriginal<typeof import('../../../utils/command.js')>();
  return { ...mod, runCommandInDir: vi.fn() };
});
vi.mock('../../../utils/feedbackTracking');
vi.mock('@hubspot/local-dev-lib/api/functions');
vi.mock('../../../../lib/accountTargetDiscovery.js');

const mockMcpFeedbackRequest = mcpFeedbackRequest as MockedFunction<
  typeof mcpFeedbackRequest
>;

const mockRunCommandInDir = runCommandInDir as MockedFunction<
  typeof runCommandInDir
>;

const mockGetRoutes = vi.mocked(getRoutes);
const mockedDiscoverAccountTargets = vi.mocked(discoverAccountTargets);

describe('HsFunctionLogsTool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let mockLogger: Mocked<McpLogger>;
  let tool: HsFunctionLogsTool;
  let mockRegisteredTool: RegisteredTool;

  beforeEach(() => {
    mockMcpServer = {
      registerTool: vi.fn(),
      server: {
        getClientCapabilities: vi.fn(),
        elicitInput: vi.fn(),
      },
    } as unknown as Mocked<McpServer>;

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as Mocked<McpLogger>;

    mockRegisteredTool = {} as RegisteredTool;
    mockMcpServer.registerTool.mockReturnValue(mockRegisteredTool);

    mockMcpFeedbackRequest.mockResolvedValue('');

    tool = new HsFunctionLogsTool(mockMcpServer, mockLogger);
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
        expect.objectContaining({
          executable: 'hs',
          args: expect.arrayContaining([
            'cms',
            'function',
            'logs',
            'my-function',
          ]),
        }),
        expect.any(Function)
      );
      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain(
        'Function executed successfully'
      );
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
        expect.objectContaining({
          executable: 'hs',
          args: expect.arrayContaining([
            'cms',
            'function',
            'logs',
            'api/my-endpoint',
          ]),
        }),
        expect.any(Function)
      );
      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain(
        'Function executed successfully'
      );
    });

    it('should execute hs logs command with latest flag', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: '2023-01-01 10:00:00 INFO Latest log entry',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        endpoint: 'my-endpoint',
        latest: true,
      });

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        expect.objectContaining({
          executable: 'hs',
          args: expect.arrayContaining([
            'cms',
            'function',
            'logs',
            'my-endpoint',
            '--latest',
            'true',
          ]),
        }),
        expect.any(Function)
      );
      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain('Latest log entry');
    });

    it('should execute hs logs command with compact flag', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'compact log output',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        endpoint: 'my-endpoint',
        compact: true,
      });

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        expect.objectContaining({
          executable: 'hs',
          args: expect.arrayContaining([
            'cms',
            'function',
            'logs',
            'my-endpoint',
            '--compact',
            'true',
          ]),
        }),
        expect.any(Function)
      );
      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain('compact log output');
    });

    it('should execute hs logs command with limit parameter', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'limited log entries',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        endpoint: 'my-endpoint',
        limit: 10,
      });

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        expect.objectContaining({
          executable: 'hs',
          args: expect.arrayContaining([
            'cms',
            'function',
            'logs',
            'my-endpoint',
            '--limit',
            '10',
          ]),
        }),
        expect.any(Function)
      );
      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain('limited log entries');
    });

    it('should execute hs logs command with account parameter', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'account-specific logs',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        endpoint: 'my-endpoint',
        account: 'test-account',
      });

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        expect.objectContaining({
          executable: 'hs',
          args: expect.arrayContaining([
            'cms',
            'function',
            'logs',
            'my-endpoint',
            '--account',
            'test-account',
          ]),
        }),
        expect.any(Function)
      );
      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain('account-specific logs');
    });

    it('should execute hs logs command with multiple parameters', async () => {
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

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        expect.objectContaining({
          executable: 'hs',
          args: expect.arrayContaining([
            'cms',
            'function',
            'logs',
            'my-endpoint',
            '--latest',
            'true',
            '--compact',
            'true',
            '--account',
            'test-account',
          ]),
        }),
        expect.any(Function)
      );
      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain('latest compact logs');
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

    it('should elicit which function when endpoint is omitted', async () => {
      mockedDiscoverAccountTargets.mockResolvedValue({
        candidates: [],
        recommended: { accountId: 123 } as AccountTargetCandidate,
      });
      mockGetRoutes.mockResolvedValue({
        data: {
          objects: [
            { route: 'alpha', method: 'GET' },
            { route: 'beta', method: 'POST' },
          ],
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({
        elicitation: { form: {} },
      });
      vi.mocked(mockMcpServer.server.elicitInput).mockResolvedValue({
        action: 'accept',
        content: { selection: 'beta' },
      });
      mockRunCommandInDir.mockResolvedValue({ stdout: 'logs', stderr: '' });

      await tool.handler({ absoluteCurrentWorkingDirectory: '/test/dir' });

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        expect.objectContaining({
          args: expect.arrayContaining(['cms', 'function', 'logs', 'beta']),
        }),
        expect.any(Function)
      );
    });

    it('should list functions when endpoint is omitted and the client cannot elicit', async () => {
      mockedDiscoverAccountTargets.mockResolvedValue({
        candidates: [],
        recommended: { accountId: 123 } as AccountTargetCandidate,
      });
      mockGetRoutes.mockResolvedValue({
        data: {
          objects: [
            { route: 'alpha', method: 'GET' },
            { route: 'beta', method: 'POST' },
          ],
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({});

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
      });

      expect(result.content[0].text).toContain(
        'Several functions are available'
      );
      expect(mockRunCommandInDir).not.toHaveBeenCalled();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HsCreateFunctionTool } from '../HsCreateFunctionTool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../../utils/logger.js';
import { runCommandInDir } from '../../../utils/command.js';
import { MockedFunction, Mocked } from 'vitest';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../../utils/logger.js');
vi.mock('../../../utils/command', async importOriginal => {
  const mod =
    await importOriginal<typeof import('../../../utils/command.js')>();
  return { ...mod, runCommandInDir: vi.fn() };
});
vi.mock('../../../utils/feedbackTracking');
vi.mock('@hubspot/local-dev-lib/config');

const mockMcpFeedbackRequest = mcpFeedbackRequest as MockedFunction<
  typeof mcpFeedbackRequest
>;

const mockRunCommandInDir = runCommandInDir as MockedFunction<
  typeof runCommandInDir
>;

describe('HsCreateFunctionTool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let mockLogger: Mocked<McpLogger>;
  let tool: HsCreateFunctionTool;
  let mockRegisteredTool: RegisteredTool;

  beforeEach(() => {
    // @ts-expect-error Not mocking the whole server
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

    tool = new HsCreateFunctionTool(mockMcpServer, mockLogger);
  });

  describe('register', () => {
    it('should register the tool with the MCP server', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'create-cms-function',
        expect.objectContaining({
          title: 'Create HubSpot CMS Serverless Function',
          description: expect.stringContaining(
            'Creates a new HubSpot CMS serverless function'
          ),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function)
      );
      expect(result).toBe(mockRegisteredTool);
    });
  });

  describe('handler', () => {
    it('should prompt for all missing required parameters', async () => {
      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
      });

      expect(result.content).toHaveLength(3);
      expect(result.content[0].text).toContain(
        'Ask the user to provide the folder name for the function'
      );
      expect(result.content[1].text).toContain(
        'Ask the user to provide the filename for the function'
      );
      expect(result.content[2].text).toContain(
        'Ask the user to provide the API endpoint path for the function'
      );
    });

    it('should not prompt when all required params provided', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Function created successfully',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        functionsFolder: 'api',
        filename: 'test-function',
        endpointPath: '/api/test',
      });

      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('Function created successfully');
    });

    it('should prompt for missing functionsFolder when other required params provided', async () => {
      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        filename: 'test-function',
        endpointPath: '/api/test',
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain(
        'Ask the user to provide the folder name for the function'
      );
    });

    it('should prompt for missing filename when other required params provided', async () => {
      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        functionsFolder: 'api',
        endpointPath: '/api/test',
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain(
        'Ask the user to provide the filename for the function'
      );
    });

    it('should prompt for missing endpointPath when other required params provided', async () => {
      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        functionsFolder: 'api',
        filename: 'test-function',
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain(
        'Ask the user to provide the API endpoint path for the function'
      );
    });

    it('should execute command with all required parameters (default GET method)', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Function created successfully',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        functionsFolder: 'api',
        filename: 'test-function',
        endpointPath: '/api/test',
      });

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        expect.objectContaining({
          executable: 'hs',
          args: expect.arrayContaining([
            'cms',
            'function',
            'create',
            '--functions-folder',
            'api',
            '--filename',
            'test-function',
            '--endpoint-method',
            'GET',
            '--endpoint-path',
            '/api/test',
          ]),
        }),
        expect.any(Function)
      );
      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('Function created successfully');
    });

    it('should execute command with POST method', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'POST function created successfully',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        functionsFolder: 'api',
        filename: 'post-function',
        endpointMethod: 'POST',
        endpointPath: '/api/create',
      });

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        expect.objectContaining({
          args: expect.arrayContaining(['--endpoint-method', 'POST']),
        }),
        expect.any(Function)
      );
      expect(result.content[0].text).toContain(
        'POST function created successfully'
      );
    });

    it('should execute command with PUT method', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'PUT function created successfully',
        stderr: '',
      });

      await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        functionsFolder: 'api',
        filename: 'put-function',
        endpointMethod: 'PUT',
        endpointPath: '/api/update',
      });

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        expect.objectContaining({
          args: expect.arrayContaining(['--endpoint-method', 'PUT']),
        }),
        expect.any(Function)
      );
    });

    it('should execute command with DELETE method', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'DELETE function created successfully',
        stderr: '',
      });

      await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        functionsFolder: 'api',
        filename: 'delete-function',
        endpointMethod: 'DELETE',
        endpointPath: '/api/delete',
      });

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        expect.objectContaining({
          args: expect.arrayContaining(['--endpoint-method', 'DELETE']),
        }),
        expect.any(Function)
      );
    });

    it('should execute command with PATCH method', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'PATCH function created successfully',
        stderr: '',
      });

      await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        functionsFolder: 'api',
        filename: 'patch-function',
        endpointMethod: 'PATCH',
        endpointPath: '/api/patch',
      });

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        expect.objectContaining({
          args: expect.arrayContaining(['--endpoint-method', 'PATCH']),
        }),
        expect.any(Function)
      );
    });

    it('should handle command execution errors', async () => {
      mockRunCommandInDir.mockRejectedValue(
        new Error('Function creation failed')
      );

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        functionsFolder: 'api',
        filename: 'test-function',
        endpointPath: '/api/test',
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain('Function creation failed');
    });

    it('should handle stderr output', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Function created successfully',
        stderr: 'Warning: Using deprecated function syntax',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        functionsFolder: 'api',
        filename: 'test-function',
        endpointPath: '/api/test',
      });

      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('Function created successfully');
      expect(result.content[1].text).toContain(
        'Warning: Using deprecated function syntax'
      );
    });

    it('should execute command with destination path', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Function created at custom path',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        dest: 'functions/custom',
        functionsFolder: 'api',
        filename: 'test-function',
        endpointPath: '/api/test',
      });

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        expect.objectContaining({
          args: expect.arrayContaining(['functions/custom']),
        }),
        expect.any(Function)
      );
      expect(result.content[0].text).toContain(
        'Function created at custom path'
      );
    });
  });
});

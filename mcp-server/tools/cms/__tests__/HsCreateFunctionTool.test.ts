import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HsCreateFunctionTool } from '../HsCreateFunctionTool.js';
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

describe('HsCreateFunctionTool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let tool: HsCreateFunctionTool;
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

    tool = new HsCreateFunctionTool(mockMcpServer);
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
      mockAddFlag
        .mockReturnValueOnce('hs create function --functions-folder api')
        .mockReturnValueOnce(
          'hs create function --functions-folder api --filename test-function'
        )
        .mockReturnValueOnce(
          'hs create function --functions-folder api --filename test-function --endpoint-method GET'
        )
        .mockReturnValueOnce(
          'hs create function --functions-folder api --filename test-function --endpoint-method GET --endpoint-path /api/test'
        );

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
      mockAddFlag
        .mockReturnValueOnce('hs create function --functions-folder api')
        .mockReturnValueOnce(
          'hs create function --functions-folder api --filename test-function'
        )
        .mockReturnValueOnce(
          'hs create function --functions-folder api --filename test-function --endpoint-method GET'
        )
        .mockReturnValueOnce(
          'hs create function --functions-folder api --filename test-function --endpoint-method GET --endpoint-path /api/test'
        );

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

      expect(mockAddFlag).toHaveBeenCalledWith(
        'hs create function',
        'functions-folder',
        'api'
      );
      expect(mockAddFlag).toHaveBeenCalledWith(
        expect.stringContaining('functions-folder'),
        'filename',
        'test-function'
      );
      expect(mockAddFlag).toHaveBeenCalledWith(
        expect.stringContaining('filename'),
        'endpoint-method',
        'GET'
      );
      expect(mockAddFlag).toHaveBeenCalledWith(
        expect.stringContaining('endpoint-method'),
        'endpoint-path',
        '/api/test'
      );
      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        expect.stringContaining('hs create function')
      );
      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('Function created successfully');
    });

    it('should execute command with POST method', async () => {
      mockAddFlag
        .mockReturnValueOnce('hs create function --functions-folder api')
        .mockReturnValueOnce(
          'hs create function --functions-folder api --filename post-function'
        )
        .mockReturnValueOnce(
          'hs create function "POST Function" --functions-folder api --filename post-function --endpoint-method POST'
        )
        .mockReturnValueOnce(
          'hs create function "POST Function" --functions-folder api --filename post-function --endpoint-method POST --endpoint-path /api/create'
        );

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

      expect(mockAddFlag).toHaveBeenCalledWith(
        expect.stringContaining('filename'),
        'endpoint-method',
        'POST'
      );
      expect(result.content[0].text).toContain(
        'POST function created successfully'
      );
    });

    it('should execute command with PUT method', async () => {
      mockAddFlag
        .mockReturnValueOnce('hs create function --functions-folder api')
        .mockReturnValueOnce(
          'hs create function "PUT Function" --functions-folder api --filename put-function'
        )
        .mockReturnValueOnce(
          'hs create function "PUT Function" --functions-folder api --filename put-function --endpoint-method PUT'
        )
        .mockReturnValueOnce(
          'hs create function "PUT Function" --functions-folder api --filename put-function --endpoint-method PUT --endpoint-path /api/update'
        );

      mockRunCommandInDir.mockResolvedValue({
        stdout: 'PUT function created successfully',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        functionsFolder: 'api',
        filename: 'put-function',
        endpointMethod: 'PUT',
        endpointPath: '/api/update',
      });

      expect(mockAddFlag).toHaveBeenCalledWith(
        expect.stringContaining('filename'),
        'endpoint-method',
        'PUT'
      );
      expect(result.content[0].text).toContain(
        'PUT function created successfully'
      );
    });

    it('should execute command with DELETE method', async () => {
      mockAddFlag
        .mockReturnValueOnce('hs create function --functions-folder api')
        .mockReturnValueOnce(
          'hs create function "DELETE Function" --functions-folder api --filename delete-function'
        )
        .mockReturnValueOnce(
          'hs create function "DELETE Function" --functions-folder api --filename delete-function --endpoint-method DELETE'
        )
        .mockReturnValueOnce(
          'hs create function "DELETE Function" --functions-folder api --filename delete-function --endpoint-method DELETE --endpoint-path /api/delete'
        );

      mockRunCommandInDir.mockResolvedValue({
        stdout: 'DELETE function created successfully',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        functionsFolder: 'api',
        filename: 'delete-function',
        endpointMethod: 'DELETE',
        endpointPath: '/api/delete',
      });

      expect(mockAddFlag).toHaveBeenCalledWith(
        expect.stringContaining('filename'),
        'endpoint-method',
        'DELETE'
      );
      expect(result.content[0].text).toContain(
        'DELETE function created successfully'
      );
    });

    it('should execute command with PATCH method', async () => {
      mockAddFlag
        .mockReturnValueOnce('hs create function --functions-folder api')
        .mockReturnValueOnce(
          'hs create function "PATCH Function" --functions-folder api --filename patch-function'
        )
        .mockReturnValueOnce(
          'hs create function "PATCH Function" --functions-folder api --filename patch-function --endpoint-method PATCH'
        )
        .mockReturnValueOnce(
          'hs create function "PATCH Function" --functions-folder api --filename patch-function --endpoint-method PATCH --endpoint-path /api/patch'
        );

      mockRunCommandInDir.mockResolvedValue({
        stdout: 'PATCH function created successfully',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        functionsFolder: 'api',
        filename: 'patch-function',
        endpointMethod: 'PATCH',
        endpointPath: '/api/patch',
      });

      expect(mockAddFlag).toHaveBeenCalledWith(
        expect.stringContaining('filename'),
        'endpoint-method',
        'PATCH'
      );
      expect(result.content[0].text).toContain(
        'PATCH function created successfully'
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
      mockAddFlag
        .mockReturnValueOnce(
          'hs create function "Test Function" --functions-folder api'
        )
        .mockReturnValueOnce(
          'hs create function "Test Function" --functions-folder api --filename test-function'
        )
        .mockReturnValueOnce(
          'hs create function "Test Function" --functions-folder api --filename test-function --endpoint-method GET'
        )
        .mockReturnValueOnce(
          'hs create function "Test Function" --functions-folder api --filename test-function --endpoint-method GET --endpoint-path /api/test'
        );

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
      mockAddFlag
        .mockReturnValueOnce(
          'hs create function "functions/custom" --functions-folder api'
        )
        .mockReturnValueOnce(
          'hs create function "functions/custom" --functions-folder api --filename test-function'
        )
        .mockReturnValueOnce(
          'hs create function "functions/custom" --functions-folder api --filename test-function --endpoint-method GET'
        )
        .mockReturnValueOnce(
          'hs create function "functions/custom" --functions-folder api --filename test-function --endpoint-method GET --endpoint-path /api/test'
        );

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
        expect.stringContaining('"functions/custom"')
      );
      expect(result.content[0].text).toContain(
        'Function created at custom path'
      );
    });
  });
});

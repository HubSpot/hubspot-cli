import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HsCreateModuleTool } from '../HsCreateModuleTool.js';
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

const mockMcpFeedbackRequest = mcpFeedbackRequest as MockedFunction<
  typeof mcpFeedbackRequest
>;

const mockRunCommandInDir = runCommandInDir as MockedFunction<
  typeof runCommandInDir
>;

describe('HsCreateModuleTool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let mockLogger: Mocked<McpLogger>;
  let tool: HsCreateModuleTool;
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

    tool = new HsCreateModuleTool(mockMcpServer, mockLogger);
  });

  describe('register', () => {
    it('should register the tool with the MCP server', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'create-cms-module',
        expect.objectContaining({
          title: 'Create HubSpot CMS Module',
          description: expect.stringContaining(
            'Creates a new HubSpot CMS module'
          ),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function)
      );

      expect(result).toBe(mockRegisteredTool);
    });
  });

  describe('handler', () => {
    it('should prompt for missing required parameters', async () => {
      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
      });

      expect(result.content).toHaveLength(3);
      expect(result.content[0].text).toContain(
        'Ask the user to specify the name of the module'
      );
      expect(result.content[1].text).toContain(
        'Ask the user to provide a label for the module'
      );
      expect(result.content[2].text).toContain(
        'Ask the user what type of module they want to create: HubL or React?'
      );
    });

    it('should prompt for missing name only when other params provided', async () => {
      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        moduleLabel: 'Test Label',
        reactType: false,
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain(
        'Ask the user to specify the name of the module'
      );
    });

    it('should prompt for missing moduleLabel when name provided', async () => {
      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        userSuppliedName: 'Test Module',
        reactType: true,
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain(
        'Ask the user to provide a label for the module'
      );
    });

    it('should prompt for missing reactType when other required params provided', async () => {
      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        userSuppliedName: 'Test Module',
        moduleLabel: 'Test Label',
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain(
        'Ask the user what type of module they want to create: HubL or React?'
      );
    });

    it('should execute command with all required parameters (HubL module)', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Module created successfully',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        userSuppliedName: 'Test Module',
        moduleLabel: 'Test Label',
        reactType: false,
      });

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        expect.objectContaining({
          executable: 'hs',
          args: expect.arrayContaining([
            'cms',
            'module',
            'create',
            'Test Module',
            '--module-label',
            'Test Label',
            '--react-type',
            'false',
            '--content-types',
            'ANY',
          ]),
        }),
        expect.any(Function)
      );
      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('Module created successfully');
    });

    it('should execute command with React module', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'React module created successfully',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        userSuppliedName: 'React Module',
        moduleLabel: 'React Label',
        reactType: true,
      });

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        expect.objectContaining({
          executable: 'hs',
          args: expect.arrayContaining([
            '--react-type',
            'true',
            '--content-types',
            'ANY',
          ]),
        }),
        expect.any(Function)
      );
      expect(result.content[0].text).toContain(
        'React module created successfully'
      );
    });

    it('should execute command with destination path', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Module created at custom path',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        userSuppliedName: 'Test Module',
        dest: 'custom/path',
        moduleLabel: 'Test Label',
        reactType: false,
      });

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        expect.objectContaining({
          args: expect.arrayContaining(['custom/path']),
        }),
        expect.any(Function)
      );
      expect(result.content[0].text).toContain('Module created at custom path');
    });

    it('should execute command with custom content types', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Module with custom content types created',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        userSuppliedName: 'Test Module',
        moduleLabel: 'Test Label',
        reactType: false,
        contentTypes: 'LANDING_PAGE,BLOG_POST',
      });

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        expect.objectContaining({
          args: expect.arrayContaining([
            '--content-types',
            'LANDING_PAGE,BLOG_POST',
          ]),
        }),
        expect.any(Function)
      );
      expect(result.content[0].text).toContain(
        'Module with custom content types created'
      );
    });

    it('should execute command with global flag', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Global module created',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        userSuppliedName: 'Global Module',
        moduleLabel: 'Global Label',
        reactType: false,
        global: true,
      });

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        expect.objectContaining({
          args: expect.arrayContaining(['--global', 'true']),
        }),
        expect.any(Function)
      );
      expect(result.content[0].text).toContain('Global module created');
    });

    it('should execute command with availableForNewContent flag', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Module created with availableForNewContent false',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        userSuppliedName: 'Test Module',
        moduleLabel: 'Test Label',
        reactType: false,
        availableForNewContent: false,
      });

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        expect.objectContaining({
          args: expect.arrayContaining([
            '--available-for-new-content',
            'false',
          ]),
        }),
        expect.any(Function)
      );
      expect(result.content[0].text).toContain(
        'Module created with availableForNewContent false'
      );
    });

    it('should handle command execution errors', async () => {
      mockRunCommandInDir.mockRejectedValue(new Error('Command failed'));

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        userSuppliedName: 'Test Module',
        moduleLabel: 'Test Label',
        reactType: false,
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain('Command failed');
    });

    it('should handle stderr output', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Module created successfully',
        stderr: 'Warning: Deprecated feature used',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        userSuppliedName: 'Test Module',
        moduleLabel: 'Test Label',
        reactType: false,
      });

      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('Module created successfully');
      expect(result.content[1].text).toContain(
        'Warning: Deprecated feature used'
      );
    });
  });
});

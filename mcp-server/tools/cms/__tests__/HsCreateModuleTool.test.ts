import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HsCreateModuleTool } from '../HsCreateModuleTool.js';
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

describe('HsCreateModuleTool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let tool: HsCreateModuleTool;
  let mockRegisteredTool: RegisteredTool;

  beforeEach(() => {
    vi.clearAllMocks();

    // @ts-expect-error Not mocking the whole server
    mockMcpServer = {
      registerTool: vi.fn(),
    };

    mockRegisteredTool = {} as RegisteredTool;
    mockMcpServer.registerTool.mockReturnValue(mockRegisteredTool);

    tool = new HsCreateModuleTool(mockMcpServer);
  });

  describe('register', () => {
    it('should register the tool with the MCP server', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'create-cms-module',
        {
          title: 'Create HubSpot CMS Module',
          description:
            'Creates a new HubSpot CMS module using the hs create module command. Modules can be created non-interactively by specifying moduleLabel and other module options. You can create either HubL or React modules by setting the reactType parameter.',
          inputSchema: expect.any(Object),
        },
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
      mockAddFlag
        .mockReturnValueOnce(
          'hs create module "Test Module" --module-label Test Label'
        )
        .mockReturnValueOnce(
          'hs create module "Test Module" --module-label Test Label --react-type false'
        )
        .mockReturnValueOnce(
          'hs create module "Test Module" --module-label Test Label --react-type false --content-types ANY'
        );

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

      expect(mockAddFlag).toHaveBeenCalledWith(
        'hs create module "Test Module"',
        'module-label',
        'Test Label'
      );
      expect(mockAddFlag).toHaveBeenCalledWith(
        expect.stringContaining('module-label'),
        'react-type',
        false
      );
      expect(mockAddFlag).toHaveBeenCalledWith(
        expect.stringContaining('react-type'),
        'content-types',
        'ANY'
      );
      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        expect.stringContaining('hs create module')
      );
      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('Module created successfully');
    });

    it('should execute command with React module', async () => {
      mockAddFlag
        .mockReturnValueOnce(
          'hs create module "React Module" --module-label React Label'
        )
        .mockReturnValueOnce(
          'hs create module "React Module" --module-label React Label --react-type true'
        )
        .mockReturnValueOnce(
          'hs create module "React Module" --module-label React Label --react-type true --content-types ANY'
        );

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

      expect(mockAddFlag).toHaveBeenCalledWith(
        expect.stringContaining('module-label'),
        'react-type',
        true
      );
      expect(result.content[0].text).toContain(
        'React module created successfully'
      );
    });

    it('should execute command with destination path', async () => {
      mockAddFlag
        .mockReturnValueOnce(
          'hs create module "Test Module" "custom/path" --module-label Test Label'
        )
        .mockReturnValueOnce(
          'hs create module "Test Module" "custom/path" --module-label Test Label --react-type false'
        )
        .mockReturnValueOnce(
          'hs create module "Test Module" "custom/path" --module-label Test Label --react-type false --content-types ANY'
        );

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
        expect.stringContaining('"custom/path"')
      );
      expect(result.content[0].text).toContain('Module created at custom path');
    });

    it('should execute command with custom content types', async () => {
      mockAddFlag
        .mockReturnValueOnce(
          'hs create module "Test Module" --module-label Test Label'
        )
        .mockReturnValueOnce(
          'hs create module "Test Module" --module-label Test Label --react-type false'
        )
        .mockReturnValueOnce(
          'hs create module "Test Module" --module-label Test Label --react-type false --content-types LANDING_PAGE,BLOG_POST'
        );

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

      expect(mockAddFlag).toHaveBeenCalledWith(
        expect.stringContaining('react-type'),
        'content-types',
        'LANDING_PAGE,BLOG_POST'
      );
      expect(result.content[0].text).toContain(
        'Module with custom content types created'
      );
    });

    it('should execute command with global flag', async () => {
      mockAddFlag
        .mockReturnValueOnce(
          'hs create module "Global Module" --module-label Global Label'
        )
        .mockReturnValueOnce(
          'hs create module "Global Module" --module-label Global Label --react-type false'
        )
        .mockReturnValueOnce(
          'hs create module "Global Module" --module-label Global Label --react-type false --content-types ANY'
        )
        .mockReturnValueOnce(
          'hs create module "Global Module" --module-label Global Label --react-type false --content-types ANY --global true'
        );

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

      expect(mockAddFlag).toHaveBeenCalledWith(
        expect.stringContaining('content-types'),
        'global',
        true
      );
      expect(result.content[0].text).toContain('Global module created');
    });

    it('should execute command with availableForNewContent flag', async () => {
      mockAddFlag
        .mockReturnValueOnce(
          'hs create module "Test Module" --module-label Test Label'
        )
        .mockReturnValueOnce(
          'hs create module "Test Module" --module-label Test Label --react-type false'
        )
        .mockReturnValueOnce(
          'hs create module "Test Module" --module-label Test Label --react-type false --content-types ANY'
        )
        .mockReturnValueOnce(
          'hs create module "Test Module" --module-label Test Label --react-type false --content-types ANY --available-for-new-content false'
        );

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

      expect(mockAddFlag).toHaveBeenCalledWith(
        expect.stringContaining('content-types'),
        'available-for-new-content',
        false
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
      mockAddFlag
        .mockReturnValueOnce(
          'hs create module "Test Module" --module-label Test Label'
        )
        .mockReturnValueOnce(
          'hs create module "Test Module" --module-label Test Label --react-type false'
        )
        .mockReturnValueOnce(
          'hs create module "Test Module" --module-label Test Label --react-type false --content-types ANY'
        );

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

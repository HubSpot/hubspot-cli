import { GuidedWalkthroughTool } from '../GuidedWalkthroughTool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { execAsync } from '../../../utils/command.js';
import { MockedFunction, Mocked } from 'vitest';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../../utils/command');
vi.mock('../../../utils/toolUsageTracking');
vi.mock('../../../utils/feedbackTracking');

const mockExecAsync = execAsync as unknown as MockedFunction<typeof execAsync>;
const mockMcpFeedbackRequest = mcpFeedbackRequest as MockedFunction<
  typeof mcpFeedbackRequest
>;

describe('mcp-server/tools/project/GuidedWalkthroughTool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let tool: GuidedWalkthroughTool;
  let mockRegisteredTool: RegisteredTool;

  beforeEach(() => {
    vi.clearAllMocks();

    // @ts-expect-error Not mocking whole server
    mockMcpServer = {
      registerTool: vi.fn(),
    };

    mockRegisteredTool = {} as RegisteredTool;
    mockMcpServer.registerTool.mockReturnValue(mockRegisteredTool);
    mockMcpFeedbackRequest.mockResolvedValue('');

    tool = new GuidedWalkthroughTool(mockMcpServer);
  });

  describe('register', () => {
    it('should register tool with correct parameters and enhanced description', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'guided-walkthrough-cli',
        expect.objectContaining({
          title: 'Guided walkthrough of the CLI',
          description: expect.stringContaining(
            'Give the user a guided walkthrough of the HubSpot CLI'
          ),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function)
      );
      expect(result).toBe(mockRegisteredTool);
    });
  });

  describe('handler', () => {
    it('should show help for hs init command', async () => {
      const helpOutput = 'Usage: hs init [options]\nInitialize HubSpot CLI';
      mockExecAsync.mockResolvedValue({
        stdout: helpOutput,
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        command: 'hs init',
      });

      expect(mockExecAsync).toHaveBeenCalledWith('hs init --help');
      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain(helpOutput);
      expect(result.content[0].text).toContain('hs auth');
    });

    it('should show help for hs auth command', async () => {
      const helpOutput = 'Usage: hs auth [options]\nAuthenticate with HubSpot';
      mockExecAsync.mockResolvedValue({
        stdout: helpOutput,
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        command: 'hs auth',
      });

      expect(mockExecAsync).toHaveBeenCalledWith('hs auth --help');
      expect(result.content[0].text).toContain(helpOutput);
      expect(result.content[0].text).toContain('hs project create');
    });

    it('should show help for hs project create command', async () => {
      const helpOutput =
        'Usage: hs project create [options]\nCreate a new project';
      mockExecAsync.mockResolvedValue({
        stdout: helpOutput,
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        command: 'hs project create',
      });

      expect(mockExecAsync).toHaveBeenCalledWith('hs project create --help');
      expect(result.content[0].text).toContain(helpOutput);
      expect(result.content[0].text).toContain('hs project upload');
    });

    it('should show help for hs project upload command', async () => {
      const helpOutput =
        'Usage: hs project upload [options]\nUpload project to HubSpot';
      mockExecAsync.mockResolvedValue({
        stdout: helpOutput,
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        command: 'hs project upload',
      });

      expect(mockExecAsync).toHaveBeenCalledWith('hs project upload --help');
      expect(result.content[0].text).toContain(helpOutput);
      expect(result.content[0].text).toContain('hs project dev');
    });

    it('should handle command without next step', async () => {
      const helpOutput =
        'Usage: hs project dev [options]\nStart development server';
      mockExecAsync.mockResolvedValue({
        stdout: helpOutput,
        stderr: '',
      });

      // Test with a command that doesn't have a next command
      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        command: 'hs project upload',
      });

      expect(result.content[0].text).toContain(helpOutput);
      expect(result.content[0].text).toContain('hs project dev');
    });

    it('should handle no command provided', async () => {
      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
      });

      expect(mockExecAsync).not.toHaveBeenCalled();
      expect(result.content).toEqual([
        {
          type: 'text',
          text: 'Is there another command you would like to learn more about?',
        },
      ]);
    });

    it('should handle undefined command', async () => {
      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        command: undefined,
      });

      expect(mockExecAsync).not.toHaveBeenCalled();
      expect(result.content).toEqual([
        {
          type: 'text',
          text: 'Is there another command you would like to learn more about?',
        },
      ]);
    });

    it('should handle execAsync errors', async () => {
      const error = new Error('Command not found');
      mockExecAsync.mockRejectedValue(error);

      await expect(
        tool.handler({
          absoluteCurrentWorkingDirectory: '/test/dir',
          command: 'hs init',
        })
      ).rejects.toThrow('Command not found');
    });

    it('should format help text with proper instructions', async () => {
      const helpOutput = 'Usage: hs init\nOptions:\n  --help  Show help';
      mockExecAsync.mockResolvedValue({
        stdout: helpOutput,
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        command: 'hs init',
      });

      expect(result.content[0].text).toContain(
        'Display this help output for the user amd wait for them to acknowledge:'
      );
      expect(result.content[0].text).toContain(helpOutput);
      expect(result.content[0].text).toContain(
        'Once they are ready, A good command to look at next is hs auth'
      );
    });
  });
});

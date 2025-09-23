import { DeployProjectTool } from '../DeployProjectTool.js';
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
vi.mock('../../../utils/toolUsageTracking');

const mockRunCommandInDir = runCommandInDir as MockedFunction<
  typeof runCommandInDir
>;
const mockAddFlag = addFlag as MockedFunction<typeof addFlag>;

describe('mcp-server/tools/project/DeployProject', () => {
  let mockMcpServer: Mocked<McpServer>;
  let tool: DeployProjectTool;
  let mockRegisteredTool: RegisteredTool;

  beforeEach(() => {
    vi.clearAllMocks();

    // @ts-expect-error Not mocking the whole server
    mockMcpServer = {
      registerTool: vi.fn(),
    };

    mockRegisteredTool = {} as RegisteredTool;
    mockMcpServer.registerTool.mockReturnValue(mockRegisteredTool);

    tool = new DeployProjectTool(mockMcpServer);

    // Mock addFlag to simulate command building
    mockAddFlag.mockImplementation(
      (command, flag, value) => `${command} --${flag} "${value}"`
    );
  });

  describe('register', () => {
    it('should register tool with correct parameters', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'deploy-project',
        {
          title: 'Deploy a build of HubSpot Project',
          description: expect.stringContaining(
            'Takes a build number and a project name and deploys that build of the project'
          ),
          inputSchema: expect.any(Object),
        },
        tool.handler
      );

      expect(result).toBe(mockRegisteredTool);
    });
  });

  describe('handler', () => {
    const baseInput = {
      absoluteProjectPath: '/test/project',
    };

    it('should deploy project with specified build number', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Project deployed successfully',
        stderr: '',
      });

      const input = {
        ...baseInput,
        buildNumber: 123,
      };

      const result = await tool.handler(input);

      expect(mockAddFlag).toHaveBeenCalledWith(
        'hs project deploy',
        'build',
        123
      );
      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/project',
        expect.stringContaining('--build "123"')
      );

      expect(result).toEqual({
        content: [
          { type: 'text', text: 'Project deployed successfully' },
          { type: 'text', text: '' },
        ],
      });
    });

    it('should prompt for build number when not provided', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Build 1: Created 2023-01-01\nBuild 2: Created 2023-01-02',
        stderr: '',
      });

      const result = await tool.handler(baseInput);

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/project',
        'hs project list-builds --limit 100'
      );

      expect(result.content).toEqual([
        {
          type: 'text',
          text: expect.stringContaining(
            'Ask the user which build number they would like to deploy?'
          ),
        },
      ]);

      expect(result.content[0].text).toContain('Build 1: Created 2023-01-01');
    });

    it('should handle deployment with stderr', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Deployed successfully',
        stderr: 'Warning: deprecated feature used',
      });

      const input = {
        ...baseInput,
        buildNumber: 456,
      };

      const result = await tool.handler(input);

      expect(result.content).toEqual([
        { type: 'text', text: 'Deployed successfully' },
        { type: 'text', text: 'Warning: deprecated feature used' },
      ]);
    });

    it('should handle errors during list-builds command', async () => {
      const error = new Error('Failed to list builds');
      mockRunCommandInDir.mockRejectedValue(error);

      // The error would be thrown and caught by the calling code
      await expect(tool.handler(baseInput)).rejects.toThrow(
        'Failed to list builds'
      );
    });

    it('should handle errors during deploy command', async () => {
      const error = new Error('Deployment failed');
      mockRunCommandInDir.mockRejectedValue(error);

      const input = {
        ...baseInput,
        buildNumber: 789,
      };

      await expect(tool.handler(input)).rejects.toThrow('Deployment failed');
    });

    it('should prompt for build when buildNumber is 0 (falsy)', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Build 0: Initial build\nBuild 1: Latest build',
        stderr: '',
      });

      const input = {
        ...baseInput,
        buildNumber: 0, // This is falsy, so it will prompt
      };

      const result = await tool.handler(input);

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/project',
        'hs project list-builds --limit 100'
      );

      expect(result.content[0].text).toContain(
        'Ask the user which build number they would like to deploy?'
      );
    });
  });
});

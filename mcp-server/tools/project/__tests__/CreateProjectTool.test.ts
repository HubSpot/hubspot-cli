import {
  CreateProjectInputSchema,
  CreateProjectTool,
} from '../CreateProjectTool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { runCommandInDir } from '../../../utils/project.js';
import { addFlag } from '../../../utils/command.js';
import {
  APP_DISTRIBUTION_TYPES,
  EMPTY_PROJECT,
  PROJECT_WITH_APP,
} from '../../../../lib/constants.js';
import { MockedFunction, Mocked } from 'vitest';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../../utils/project');
vi.mock('../../../utils/command');
vi.mock('../../../../lib/constants');
vi.mock('../../../../lib/projects/create/v2');
vi.mock('../../../utils/toolUsageTracking');

const mockRunCommandInDir = runCommandInDir as MockedFunction<
  typeof runCommandInDir
>;
const mockAddFlag = addFlag as MockedFunction<typeof addFlag>;

describe('mcp-server/tools/project/CreateProjectTool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let tool: CreateProjectTool;
  let mockRegisteredTool: RegisteredTool;

  beforeEach(() => {
    vi.clearAllMocks();

    // @ts-expect-error Not mocking the whole thing
    mockMcpServer = {
      registerTool: vi.fn(),
    };

    mockRegisteredTool = {} as RegisteredTool;
    mockMcpServer.registerTool.mockReturnValue(mockRegisteredTool);

    tool = new CreateProjectTool(mockMcpServer);

    // Mock addFlag to simulate command building
    mockAddFlag.mockImplementation(
      (command, flag, value) => `${command} --${flag} "${value}"`
    );
  });

  describe('register', () => {
    it('should register tool with correct parameters', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'create-project',
        {
          title: 'Create HubSpot Project',
          description:
            'Creates a HubSpot project with the provided name and outputs it in the provided destination',
          inputSchema: expect.any(Object),
        },
        tool.handler
      );

      expect(result).toBe(mockRegisteredTool);
    });
  });

  describe('handler', () => {
    const baseInput: CreateProjectInputSchema = {
      absoluteCurrentWorkingDirectory: '/test/workspace',
      name: 'test-project',
      destination: './test-dest',
      projectBase: EMPTY_PROJECT,
    };

    it('should handle successful command execution', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Project created successfully',
        stderr: '',
      });

      const result = await tool.handler(baseInput);

      expect(mockAddFlag).toHaveBeenCalledWith(
        'hs project create',
        'platform-version',
        '2025.2'
      );
      expect(mockAddFlag).toHaveBeenCalledWith(
        expect.any(String),
        'name',
        'test-project'
      );
      expect(mockAddFlag).toHaveBeenCalledWith(
        expect.any(String),
        'dest',
        './test-dest'
      );
      expect(mockAddFlag).toHaveBeenCalledWith(
        expect.any(String),
        'project-base',
        EMPTY_PROJECT
      );

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/workspace',
        expect.any(String)
      );

      expect(result).toEqual({
        content: [
          { type: 'text', text: 'Project created successfully' },
          { type: 'text', text: '' },
        ],
      });
    });

    it('should handle command execution error', async () => {
      const error = new Error('Command failed');
      mockRunCommandInDir.mockRejectedValue(error);

      const result = await tool.handler(baseInput);

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Command failed' }],
      });
    });

    it('should prompt for distribution and auth when creating app project without both', async () => {
      const input: CreateProjectInputSchema = {
        ...baseInput,
        projectBase: PROJECT_WITH_APP,
      };

      const result = await tool.handler(input);

      expect(result.content).toEqual([
        {
          type: 'text',
          text: expect.stringContaining(
            'Ask the user how they would you like to distribute the application?'
          ),
        },
        {
          type: 'text',
          text: expect.stringContaining(
            'Ask the user which auth type they would like to use?'
          ),
        },
      ]);
    });

    it('should prompt for auth when creating app project without auth', async () => {
      const input: CreateProjectInputSchema = {
        ...baseInput,
        projectBase: PROJECT_WITH_APP,
        distribution: APP_DISTRIBUTION_TYPES.PRIVATE,
      };

      const result = await tool.handler(input);

      expect(result.content).toEqual([
        {
          type: 'text',
          text: expect.stringContaining(
            'Ask the user which auth type they would like to use?'
          ),
        },
      ]);
    });

    it('should add features flag when features are provided', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Project created',
        stderr: '',
      });

      const input: CreateProjectInputSchema = {
        ...baseInput,
        features: ['card', 'settings'],
      };

      await tool.handler(input);

      expect(mockAddFlag).toHaveBeenCalledWith(expect.any(String), 'features', [
        'card',
        'settings',
      ]);
    });

    it('should handle non-Error rejection', async () => {
      mockRunCommandInDir.mockRejectedValue('String error');

      const result = await tool.handler(baseInput);

      expect(result).toEqual({
        content: [{ type: 'text', text: 'String error' }],
      });
    });
  });
});

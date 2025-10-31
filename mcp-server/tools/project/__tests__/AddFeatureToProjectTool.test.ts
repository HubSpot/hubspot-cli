import {
  AddFeatureInputSchema,
  AddFeatureToProjectTool,
} from '../AddFeatureToProjectTool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { MockedFunction, Mocked } from 'vitest';
import { runCommandInDir } from '../../../utils/project.js';
import { addFlag } from '../../../utils/command.js';
import {
  APP_AUTH_TYPES,
  APP_DISTRIBUTION_TYPES,
} from '../../../../lib/constants.js';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../../utils/project');
vi.mock('../../../utils/command');
vi.mock('../../../../lib/constants');
vi.mock('../../../utils/toolUsageTracking');
vi.mock('../../../utils/feedbackTracking');

const mockMcpFeedbackRequest = mcpFeedbackRequest as MockedFunction<
  typeof mcpFeedbackRequest
>;

const mockRunCommandInDir = runCommandInDir as MockedFunction<
  typeof runCommandInDir
>;
const mockAddFlag = addFlag as MockedFunction<typeof addFlag>;

describe('mcp-server/tools/project/AddFeatureToProject', () => {
  let mockMcpServer: Mocked<McpServer>;
  let tool: AddFeatureToProjectTool;
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

    tool = new AddFeatureToProjectTool(mockMcpServer);

    // Mock addFlag to simulate command building
    mockAddFlag.mockImplementation(
      (command, flag, value) => `${command} --${flag} "${value}"`
    );
  });

  describe('register', () => {
    it('should register tool with correct parameters', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'add-feature-to-project',
        expect.objectContaining({
          title: 'Add feature to HubSpot Project',
          description: expect.stringContaining(
            'Adds a feature to an existing HubSpot project'
          ),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function)
      );
      expect(result).toBe(mockRegisteredTool);
    });
  });

  describe('handler', () => {
    const baseInput: AddFeatureInputSchema = {
      absoluteCurrentWorkingDirectory: '/test/dir',
      absoluteProjectPath: '/test/project',
      addApp: false,
    };

    it('should handle successful command execution without app', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Feature added successfully',
        stderr: '',
      });

      const result = await tool.handler(baseInput);

      expect(mockAddFlag).toHaveBeenCalledWith(
        'hs project add',
        'features',
        []
      );
      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/project',
        expect.any(String)
      );

      expect(result).toEqual({
        content: [
          { type: 'text', text: 'Feature added successfully' },
          { type: 'text', text: '' },
        ],
      });
    });

    it('should handle successful command execution with features', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Features added successfully',
        stderr: '',
      });

      const input: AddFeatureInputSchema = {
        ...baseInput,
        features: ['card', 'settings'],
      };

      await tool.handler(input);

      expect(mockAddFlag).toHaveBeenCalledWith('hs project add', 'features', [
        'card',
        'settings',
      ]);
    });

    it('should prompt for distribution and auth when adding app without both', async () => {
      const input = {
        ...baseInput,
        addApp: true,
      };

      const result = await tool.handler(input);

      expect(result.content).toEqual([
        {
          type: 'text',
          text: expect.stringContaining(
            'Ask the user how they would you like to distribute the application'
          ),
        },
        {
          type: 'text',
          text: expect.stringContaining(
            'Ask the user which auth type they would like to use'
          ),
        },
      ]);
    });

    it('should prompt for auth when adding app without auth', async () => {
      const input: AddFeatureInputSchema = {
        ...baseInput,
        addApp: true,
        distribution: APP_DISTRIBUTION_TYPES.PRIVATE,
      };

      const result = await tool.handler(input);

      expect(result.content).toEqual([
        {
          type: 'text',
          text: expect.stringContaining(
            'Ask the user which auth type they would like to use'
          ),
        },
      ]);
    });

    it('should add distribution and auth flags when provided', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'App feature added',
        stderr: '',
      });

      const input: AddFeatureInputSchema = {
        ...baseInput,
        addApp: true,
        distribution: APP_DISTRIBUTION_TYPES.MARKETPLACE,
        auth: APP_AUTH_TYPES.OAUTH,
        features: ['webhooks'],
      };

      await tool.handler(input);

      expect(mockAddFlag).toHaveBeenCalledWith(
        'hs project add',
        'distribution',
        APP_DISTRIBUTION_TYPES.MARKETPLACE
      );
      expect(mockAddFlag).toHaveBeenCalledWith(
        expect.any(String),
        'auth',
        APP_AUTH_TYPES.OAUTH
      );
      expect(mockAddFlag).toHaveBeenCalledWith(expect.any(String), 'features', [
        'webhooks',
      ]);
    });

    it('should handle command execution error', async () => {
      const error = new Error('Command failed');
      mockRunCommandInDir.mockRejectedValue(error);

      const result = await tool.handler(baseInput);

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Command failed' }],
      });
    });

    it('should handle non-Error rejection', async () => {
      mockRunCommandInDir.mockRejectedValue('String error');

      const result = await tool.handler(baseInput);

      expect(result).toEqual({
        content: [{ type: 'text', text: 'String error' }],
      });
    });

    it('should handle stderr in results', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Success with warnings',
        stderr: 'Warning: something happened',
      });

      const result = await tool.handler(baseInput);

      expect(result.content).toEqual([
        { type: 'text', text: 'Success with warnings' },
        { type: 'text', text: 'Warning: something happened' },
      ]);
    });
  });
});

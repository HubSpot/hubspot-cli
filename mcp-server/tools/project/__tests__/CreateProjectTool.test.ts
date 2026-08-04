import {
  CreateProjectInputSchema,
  CreateProjectTool,
} from '../CreateProjectTool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../../utils/logger.js';
import { runCommandInDir } from '../../../utils/command.js';
import {
  APP_DISTRIBUTION_TYPES,
  EMPTY_PROJECT,
  PROJECT_WITH_APP,
} from '../../../../lib/constants.js';
import { MockedFunction, Mocked } from 'vitest';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../../utils/logger.js');
vi.mock('../../../utils/command', async importOriginal => {
  const mod =
    await importOriginal<typeof import('../../../utils/command.js')>();
  return { ...mod, runCommandInDir: vi.fn() };
});
vi.mock('../../../../lib/constants');
vi.mock('../../../../lib/projects/create/v2');
vi.mock('../../../utils/feedbackTracking');

const mockMcpFeedbackRequest = mcpFeedbackRequest as MockedFunction<
  typeof mcpFeedbackRequest
>;

const mockRunCommandInDir = runCommandInDir as MockedFunction<
  typeof runCommandInDir
>;

describe('mcp-server/tools/project/CreateProjectTool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let mockLogger: Mocked<McpLogger>;
  let tool: CreateProjectTool;
  let mockRegisteredTool: RegisteredTool;

  beforeEach(() => {
    // @ts-expect-error Not mocking the whole thing
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

    tool = new CreateProjectTool(mockMcpServer, mockLogger);
  });

  describe('register', () => {
    it('should register tool with correct parameters', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'create-project',
        expect.objectContaining({
          title: 'Create HubSpot Project',
          description: expect.stringContaining(
            'Creates a HubSpot project with the provided name'
          ),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function)
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

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/workspace',
        expect.objectContaining({
          executable: 'hs',
          args: expect.arrayContaining([
            'project',
            'create',
            '--name',
            'test-project',
            '--dest',
            './test-dest',
            '--project-base',
            EMPTY_PROJECT,
          ]),
        }),
        expect.any(Function)
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
            'Ask the user how they would you like to distribute the app?'
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

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/workspace',
        expect.objectContaining({
          executable: 'hs',
          args: expect.arrayContaining(['--features', 'card', 'settings']),
        }),
        expect.any(Function)
      );
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

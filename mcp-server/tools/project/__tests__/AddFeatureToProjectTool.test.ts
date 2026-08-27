import {
  AddFeatureInputSchema,
  AddFeatureToProjectTool,
} from '../AddFeatureToProjectTool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../../utils/logger.js';
import { MockedFunction, Mocked } from 'vitest';
import { runCommandInDir } from '../../../utils/command.js';
import {
  APP_AUTH_TYPES,
  APP_DISTRIBUTION_TYPES,
} from '../../../../lib/constants.js';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../../utils/logger.js');
vi.mock('../../../utils/command', async importOriginal => {
  const mod =
    await importOriginal<typeof import('../../../utils/command.js')>();
  return { ...mod, runCommandInDir: vi.fn() };
});
vi.mock('../../../../lib/constants');
vi.mock('../../../utils/feedbackTracking');

const mockMcpFeedbackRequest = mcpFeedbackRequest as MockedFunction<
  typeof mcpFeedbackRequest
>;

const mockRunCommandInDir = runCommandInDir as MockedFunction<
  typeof runCommandInDir
>;

describe('mcp-server/tools/project/AddFeatureToProject', () => {
  let mockMcpServer: Mocked<McpServer>;
  let mockLogger: Mocked<McpLogger>;
  let tool: AddFeatureToProjectTool;
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

    tool = new AddFeatureToProjectTool(mockMcpServer, mockLogger);
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

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/project',
        expect.objectContaining({
          executable: 'hs',
          args: expect.arrayContaining(['project', 'add', '--features']),
        }),
        expect.any(Function)
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

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/project',
        expect.objectContaining({
          executable: 'hs',
          args: expect.arrayContaining([
            'project',
            'add',
            '--features',
            'card',
            'settings',
          ]),
        }),
        expect.any(Function)
      );
    });

    it('should handle crm-bulk-action as a valid feature', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Bulk action added successfully',
        stderr: '',
      });

      const input: AddFeatureInputSchema = {
        ...baseInput,
        features: ['crm-bulk-action'],
      };

      await tool.handler(input);

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/project',
        expect.objectContaining({
          executable: 'hs',
          args: expect.arrayContaining([
            'project',
            'add',
            '--features',
            'crm-bulk-action',
          ]),
        }),
        expect.any(Function)
      );
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
            'Ask the user how they would you like to distribute the app'
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

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/project',
        expect.objectContaining({
          executable: 'hs',
          args: expect.arrayContaining([
            'project',
            'add',
            '--distribution',
            APP_DISTRIBUTION_TYPES.MARKETPLACE,
            '--auth',
            APP_AUTH_TYPES.OAUTH,
            '--features',
            'webhooks',
          ]),
        }),
        expect.any(Function)
      );
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

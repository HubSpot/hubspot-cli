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

const validOutput = { addedFeatures: ['card'] };

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
          outputSchema: expect.any(Object),
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
        stdout: JSON.stringify(validOutput),
        stderr: '',
      });

      const result = await tool.handler(baseInput);

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/project',
        expect.objectContaining({
          executable: 'hs',
          args: expect.arrayContaining([
            'project',
            'add',
            '--json',
            'true',
            '--features',
          ]),
        }),
        expect.any(Function)
      );

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(validOutput) }],
        structuredContent: validOutput,
      });
    });

    it('should handle successful command execution with features', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: JSON.stringify(validOutput),
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
        stdout: JSON.stringify(validOutput),
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

      expect(mockRunCommandInDir).not.toHaveBeenCalled();
      expect(result.structuredContent).toEqual({});
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

      expect(result.structuredContent).toEqual({});
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
        stdout: JSON.stringify(validOutput),
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

    it('should return the parsed app output as structuredContent', async () => {
      const appOutput = {
        addedFeatures: ['webhooks'],
        app: { distribution: 'marketplace', auth: 'oauth' },
      };
      mockRunCommandInDir.mockResolvedValue({
        stdout: JSON.stringify(appOutput, null, 2),
        stderr: '',
      });

      const result = await tool.handler(baseInput);

      expect(result.structuredContent).toEqual(appOutput);
      expect(result.isError).toBeUndefined();
    });

    it('should fall back to empty structuredContent when output is not valid schema JSON', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: JSON.stringify({ addedFeatures: 'not-an-array' }),
        stderr: '',
      });

      const result = await tool.handler(baseInput);

      expect(result.structuredContent).toEqual({});
      expect(result.isError).toBeUndefined();
    });

    it('should handle command execution error', async () => {
      const error = new Error('Command failed');
      mockRunCommandInDir.mockRejectedValue(error);

      await expect(tool.handler(baseInput)).rejects.toThrow('Command failed');
    });

    it('should handle stderr in results', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: JSON.stringify(validOutput),
        stderr: 'Warning: something happened',
      });

      const result = await tool.handler(baseInput);

      expect(result.content).toEqual([
        { type: 'text', text: JSON.stringify(validOutput) },
        { type: 'text', text: 'Warning: something happened' },
      ]);
      expect(result.structuredContent).toEqual(validOutput);
    });
  });
});

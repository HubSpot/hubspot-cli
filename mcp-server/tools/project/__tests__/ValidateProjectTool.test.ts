import {
  CreateProjectInputSchema,
  ValidateProjectTool,
} from '../ValidateProjectTool.js';
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

describe('mcp-server/tools/project/ValidateProjectTool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let mockLogger: Mocked<McpLogger>;
  let tool: ValidateProjectTool;
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

    tool = new ValidateProjectTool(mockMcpServer, mockLogger);
  });

  describe('register', () => {
    it('should register tool with correct parameters', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'validate-project',
        expect.objectContaining({
          title: expect.stringContaining('Validate HubSpot Project'),
          description: expect.stringContaining(
            'Validates the HubSpot project and its configuration files.'
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
    const input: CreateProjectInputSchema = {
      absoluteCurrentWorkingDirectory: '/test/dir',
      absoluteProjectPath: '/test/project',
    };

    const validOutput = {
      valid: true,
      projectName: 'test-project',
      platformVersion: '2025.2',
      errors: [],
      warnings: [],
    };

    it('should validate project successfully', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: JSON.stringify(validOutput),
        stderr: '',
      });

      const result = await tool.handler(input);

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/project',
        expect.objectContaining({
          executable: 'hs',
          args: ['project', 'validate', '--json', 'true'],
        }),
        expect.any(Function)
      );

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(validOutput) }],
        structuredContent: validOutput,
      });
    });

    it('should return parsed JSON output as structuredContent', async () => {
      const output = {
        valid: false,
        errors: [{ message: 'Missing required field', file: 'app.json' }],
        warnings: [{ message: 'Deprecated field' }],
      };
      mockRunCommandInDir.mockResolvedValue({
        stdout: JSON.stringify(output, null, 2),
        stderr: '',
      });

      const result = await tool.handler(input);

      expect(result.structuredContent).toEqual(output);
      expect(result.isError).toBeUndefined();
    });

    it('should recover structuredContent from stdout when the command exits non-zero', async () => {
      const output = {
        valid: false,
        errors: [{ message: 'Invalid project' }],
        warnings: [],
      };
      mockRunCommandInDir.mockRejectedValue(
        Object.assign(new Error('Command failed'), {
          code: 1,
          stdout: JSON.stringify(output),
          stderr: 'Error: project is invalid',
        })
      );

      const result = await tool.handler(input);

      expect(result.structuredContent).toEqual(output);
      expect(result.isError).toBeUndefined();
      expect(result.content).toEqual([
        { type: 'text', text: JSON.stringify(output) },
        { type: 'text', text: 'Error: project is invalid' },
      ]);
    });

    it('should mark the response as an error when stdout is not valid schema JSON', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: JSON.stringify({ valid: 'not-a-boolean' }),
        stderr: '',
      });

      const result = await tool.handler(input);

      expect(result.structuredContent).toBeUndefined();
      expect(result.isError).toBe(true);
    });

    it('should handle a rejection with no stdout as an error', async () => {
      mockRunCommandInDir.mockRejectedValue(new Error('Validation failed'));

      const result = await tool.handler(input);

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Validation failed' }],
        isError: true,
      });
    });

    it('should handle non-Error rejection', async () => {
      mockRunCommandInDir.mockRejectedValue('String error');

      const result = await tool.handler(input);

      expect(result).toEqual({
        content: [{ type: 'text', text: 'String error' }],
        isError: true,
      });
    });

    it('should work with different project paths', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: JSON.stringify(validOutput),
        stderr: '',
      });

      const differentInput = {
        absoluteCurrentWorkingDirectory: '/test/dir',
        absoluteProjectPath: '/different/path/to/project',
      };

      await tool.handler(differentInput);

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/different/path/to/project',
        expect.objectContaining({
          executable: 'hs',
          args: ['project', 'validate', '--json', 'true'],
        }),
        expect.any(Function)
      );
    });
  });
});

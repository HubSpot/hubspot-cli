import {
  CreateProjectInputSchema,
  ValidateProjectTool,
} from '../ValidateProjectTool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { runCommandInDir } from '../../../utils/project.js';
import { MockedFunction, Mocked } from 'vitest';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../../utils/project');
vi.mock('../../../utils/toolUsageTracking');

const mockRunCommandInDir = runCommandInDir as MockedFunction<
  typeof runCommandInDir
>;

describe('mcp-server/tools/project/ValidateProjectTool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let tool: ValidateProjectTool;
  let mockRegisteredTool: RegisteredTool;

  beforeEach(() => {
    vi.clearAllMocks();

    // @ts-expect-error Not mocking the whole thing
    mockMcpServer = {
      registerTool: vi.fn(),
    };

    mockRegisteredTool = {} as RegisteredTool;
    mockMcpServer.registerTool.mockReturnValue(mockRegisteredTool);

    tool = new ValidateProjectTool(mockMcpServer);
  });

  describe('register', () => {
    it('should register tool with correct parameters', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'validate-project',
        {
          title: expect.stringContaining('Validate HubSpot Project'),
          description: expect.stringContaining(
            'Validates the HubSpot project and its configuration files.'
          ),
          inputSchema: expect.any(Object),
        },
        tool.handler
      );

      expect(result).toBe(mockRegisteredTool);
    });
  });

  describe('handler', () => {
    const input: CreateProjectInputSchema = {
      absoluteProjectPath: '/test/project',
    };

    it('should validate project successfully', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Project validation successful',
        stderr: '',
      });

      const result = await tool.handler(input);

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/project',
        'hs project validate'
      );

      expect(result).toEqual({
        content: [
          { type: 'text', text: 'Project validation successful' },
          { type: 'text', text: '' },
        ],
      });
    });

    it('should handle validation with warnings', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Project is valid',
        stderr: 'Warning: some files may need updates',
      });

      const result = await tool.handler(input);

      expect(result.content).toEqual([
        { type: 'text', text: 'Project is valid' },
        { type: 'text', text: 'Warning: some files may need updates' },
      ]);
    });

    it('should handle validation errors', async () => {
      const error = new Error('Validation failed');
      mockRunCommandInDir.mockRejectedValue(error);

      const result = await tool.handler(input);

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Validation failed' }],
      });
    });

    it('should handle non-Error rejection', async () => {
      mockRunCommandInDir.mockRejectedValue('String error');

      const result = await tool.handler(input);

      expect(result).toEqual({
        content: [{ type: 'text', text: 'String error' }],
      });
    });

    it('should handle empty stdout and stderr', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'stdout',
        stderr: 'stderr',
      });

      const result = await tool.handler(input);

      expect(result.content).toEqual([
        { type: 'text', text: 'stdout' },
        { type: 'text', text: 'stderr' },
      ]);
    });

    it('should work with different project paths', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Validation complete',
        stderr: '',
      });

      const differentInput = {
        absoluteProjectPath: '/different/path/to/project',
      };

      await tool.handler(differentInput);

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/different/path/to/project',
        'hs project validate'
      );
    });

    it('should handle validation errors with stderr', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: '',
        stderr: 'Error: Missing required configuration file',
      });

      const result = await tool.handler(input);

      expect(result.content).toEqual([
        { type: 'text', text: '' },
        { type: 'text', text: 'Error: Missing required configuration file' },
      ]);
    });
  });
});

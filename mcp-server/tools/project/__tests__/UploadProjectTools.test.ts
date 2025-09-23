import { UploadProjectTools } from '../UploadProjectTools.js';
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

describe('mcp-server/tools/project/UploadProjectTools', () => {
  let mockMcpServer: Mocked<McpServer>;
  let tool: UploadProjectTools;
  let mockRegisteredTool: RegisteredTool;

  beforeEach(() => {
    vi.clearAllMocks();

    // @ts-expect-error noy mocking whole server
    mockMcpServer = {
      registerTool: vi.fn(),
    };

    mockRegisteredTool = {} as RegisteredTool;
    mockMcpServer.registerTool.mockReturnValue(mockRegisteredTool);

    tool = new UploadProjectTools(mockMcpServer);
  });

  describe('register', () => {
    it('should register tool with correct parameters', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'upload-project',
        {
          title: 'Upload HubSpot Project',
          description: expect.stringContaining(
            'Uploads the HubSpot project in current working directory.'
          ),
          inputSchema: expect.any(Object),
        },
        tool.handler
      );

      expect(result).toBe(mockRegisteredTool);
    });
  });

  describe('handler', () => {
    const input = {
      absoluteProjectPath: '/test/project',
    };

    it('should upload project successfully', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Project uploaded successfully',
        stderr: '',
      });

      const result = await tool.handler(input);

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/project',
        'hs project upload --force-create'
      );

      expect(result).toEqual({
        content: [
          { type: 'text', text: 'Project uploaded successfully' },
          { type: 'text', text: '' },
        ],
      });
    });

    it('should handle upload with warnings', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Project uploaded with warnings',
        stderr: 'Warning: some files were ignored',
      });

      const result = await tool.handler(input);

      expect(result.content).toEqual([
        { type: 'text', text: 'Project uploaded with warnings' },
        { type: 'text', text: 'Warning: some files were ignored' },
      ]);
    });

    it('should handle upload errors', async () => {
      const error = new Error('Upload failed');
      mockRunCommandInDir.mockRejectedValue(error);

      await expect(tool.handler(input)).rejects.toThrow('Upload failed');
    });

    it('should use force-create flag', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Project created and uploaded',
        stderr: '',
      });

      await tool.handler(input);

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/project',
        'hs project upload --force-create'
      );
    });

    it('should handle empty stdout and stderr', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: '',
        stderr: '',
      });

      const result = await tool.handler(input);

      expect(result.content).toEqual([
        { type: 'text', text: '' },
        { type: 'text', text: '' },
      ]);
    });

    it('should work with different project paths', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Upload complete',
        stderr: '',
      });

      const differentInput = {
        absoluteProjectPath: '/different/path/to/project',
      };

      await tool.handler(differentInput);

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/different/path/to/project',
        'hs project upload --force-create'
      );
    });

    it('should handle very long output', async () => {
      const longOutput = 'A'.repeat(10000);
      mockRunCommandInDir.mockResolvedValue({
        stdout: longOutput,
        stderr: 'Long stderr output',
      });

      const result = await tool.handler(input);

      expect(result.content[0].text).toBe(longOutput);
      expect(result.content[1].text).toBe('Long stderr output');
    });
  });
});

import { MockedFunction, Mocked } from 'vitest';
import { UploadProjectTools } from '../UploadProjectTools.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAllHsProfiles } from '@hubspot/project-parsing-lib/profiles';
import { getProjectConfig } from '../../../../lib/projects/config.js';
import { runCommandInDir } from '../../../utils/project.js';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';
import { trackToolUsage } from '../../../utils/toolUsageTracking.js';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('@hubspot/project-parsing-lib/profiles');
vi.mock('../../../../lib/projects/config.js');
vi.mock('../../../utils/project');
vi.mock('../../../utils/toolUsageTracking');
vi.mock('../../../utils/feedbackTracking');

const mockTrackToolUsage = trackToolUsage as MockedFunction<
  typeof trackToolUsage
>;

const mockMcpFeedbackRequest = mcpFeedbackRequest as MockedFunction<
  typeof mcpFeedbackRequest
>;

const mockRunCommandInDir = runCommandInDir as MockedFunction<
  typeof runCommandInDir
>;

const mockGetProjectConfig = getProjectConfig as MockedFunction<
  typeof getProjectConfig
>;

const mockGetAllHsProfiles = getAllHsProfiles as MockedFunction<
  typeof getAllHsProfiles
>;

describe('mcp-server/tools/project/UploadProjectTools', () => {
  let mockMcpServer: Mocked<McpServer>;
  let tool: UploadProjectTools;
  let mockRegisteredTool: RegisteredTool;

  beforeEach(() => {
    // @ts-expect-error noy mocking whole server
    mockMcpServer = {
      registerTool: vi.fn(),
    };

    mockRegisteredTool = {} as RegisteredTool;
    mockMcpServer.registerTool.mockReturnValue(mockRegisteredTool);
    mockMcpFeedbackRequest.mockResolvedValue('');
    mockTrackToolUsage.mockResolvedValue(undefined);
    mockGetProjectConfig.mockResolvedValue({
      projectConfig: {
        srcDir: 'src',
        name: 'test-project',
        platformVersion: '2025.2',
      },
      projectDir: '/test/project',
    });
    mockGetAllHsProfiles.mockResolvedValue([]);

    tool = new UploadProjectTools(mockMcpServer);
  });

  describe('register', () => {
    it('should register tool with correct parameters', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'upload-project',
        expect.objectContaining({
          title: 'Upload HubSpot Project',
          description: expect.stringContaining(
            'Uploads the HubSpot project in current working directory.'
          ),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function)
      );
      expect(result).toBe(mockRegisteredTool);
    });
  });

  describe('handler', () => {
    const input = {
      absoluteCurrentWorkingDirectory: '/test/dir',
      absoluteProjectPath: '/test/project',
      uploadMessage: 'Test upload message',
    };

    it('should upload project successfully', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Project uploaded successfully',
        stderr: '',
      });

      const result = await tool.handler(input);

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/project',
        expect.stringContaining('hs project upload')
      );
      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/project',
        expect.stringContaining('--force-create')
      );
      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/project',
        expect.stringContaining('--message "Test upload message"')
      );

      expect(result).toEqual({
        content: [
          { type: 'text', text: 'Project uploaded successfully' },
          { type: 'text', text: '' },
          {
            type: 'text',
            text: '\nIMPORTANT: If this project contains cards, remember that uploading does NOT make them live automatically. Cards must be manually added to a view in HubSpot to become visible to users.',
          },
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
        {
          type: 'text',
          text: '\nIMPORTANT: If this project contains cards, remember that uploading does NOT make them live automatically. Cards must be manually added to a view in HubSpot to become visible to users.',
        },
      ]);
    });

    it('should handle upload errors', async () => {
      const error = new Error('Upload failed');
      mockRunCommandInDir.mockRejectedValue(error);

      await expect(tool.handler(input)).rejects.toThrow('Upload failed');
    });

    it('should use force-create and message flags', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Project created and uploaded',
        stderr: '',
      });

      await tool.handler(input);

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/project',
        expect.stringContaining('hs project upload')
      );
      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/project',
        expect.stringContaining('--force-create')
      );
      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/project',
        expect.stringContaining('--message "Test upload message"')
      );
    });

    it('should use profiles', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Project created and uploaded',
        stderr: '',
      });

      await tool.handler({
        ...input,
        profile: 'dev',
      });

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/project',
        expect.stringContaining('hs project upload')
      );
      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/project',
        expect.stringContaining('--force-create')
      );
      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/project',
        expect.stringContaining('--message "Test upload message"')
      );
      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/project',
        expect.stringContaining('--profile "dev"')
      );
    });

    it('should prompt for profile if not specified and the project requires them', async () => {
      mockGetAllHsProfiles.mockResolvedValue(['prod', 'dev']);

      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Project created and uploaded',
        stderr: '',
      });

      const result = await tool.handler(input);

      expect(mockRunCommandInDir).not.toHaveBeenCalled();
      expect(result.content).toEqual([
        {
          type: 'text',
          text: 'Ask the user which profile they would like to use for the upload.',
        },
      ]);
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
        {
          type: 'text',
          text: '\nIMPORTANT: If this project contains cards, remember that uploading does NOT make them live automatically. Cards must be manually added to a view in HubSpot to become visible to users.',
        },
      ]);
    });

    it('should work with different project paths', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Upload complete',
        stderr: '',
      });

      const differentInput = {
        absoluteCurrentWorkingDirectory: '/test/dir',
        absoluteProjectPath: '/different/path/to/project',
        uploadMessage: 'Different test upload message',
      };

      await tool.handler(differentInput);

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/different/path/to/project',
        expect.stringContaining('hs project upload')
      );
      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/different/path/to/project',
        expect.stringContaining('--force-create')
      );
      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/different/path/to/project',
        expect.stringContaining('--message "Different test upload message"')
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

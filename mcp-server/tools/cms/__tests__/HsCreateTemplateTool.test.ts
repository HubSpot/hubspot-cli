import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HsCreateTemplateTool } from '../HsCreateTemplateTool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { runCommandInDir } from '../../../utils/project.js';
import { addFlag } from '../../../utils/command.js';
import { MockedFunction, Mocked } from 'vitest';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../../utils/project');
vi.mock('../../../utils/command');
vi.mock('../../../utils/toolUsageTracking', () => ({
  trackToolUsage: vi.fn(),
}));
vi.mock('../../../utils/feedbackTracking');

const mockMcpFeedbackRequest = mcpFeedbackRequest as MockedFunction<
  typeof mcpFeedbackRequest
>;

const mockRunCommandInDir = runCommandInDir as MockedFunction<
  typeof runCommandInDir
>;
const mockAddFlag = addFlag as MockedFunction<typeof addFlag>;

describe('HsCreateTemplateTool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let tool: HsCreateTemplateTool;
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

    tool = new HsCreateTemplateTool(mockMcpServer);
  });

  describe('register', () => {
    it('should register the tool with the MCP server', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'create-cms-template',
        expect.objectContaining({
          title: 'Create HubSpot CMS Template',
          description: expect.stringContaining(
            'Creates a new HubSpot CMS template'
          ),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function)
      );
      expect(result).toBe(mockRegisteredTool);
    });
  });

  describe('handler', () => {
    it('should prompt for missing required parameters', async () => {
      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
      });

      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain(
        'Ask the user to specify the name of the template'
      );
      expect(result.content[1].text).toContain(
        'Ask the user what template type they want to create'
      );
      expect(result.content[1].text).toContain(
        'page-template, email-template, partial, global-partial'
      );
    });

    it('should prompt for missing name only when template type provided', async () => {
      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        templateType: 'page-template',
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain(
        'Ask the user to specify the name of the template'
      );
    });

    it('should prompt for missing templateType when name provided', async () => {
      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        userSuppliedName: 'Test Template',
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain(
        'Ask the user what template type they want to create'
      );
    });

    it('should execute command with all required parameters (page template)', async () => {
      mockAddFlag.mockReturnValueOnce(
        'hs create template "Page Template" --template-type page-template'
      );

      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Page template created successfully',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        userSuppliedName: 'Page Template',
        templateType: 'page-template',
      });

      expect(mockAddFlag).toHaveBeenCalledWith(
        'hs create template "Page Template"',
        'template-type',
        'page-template'
      );
      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        'hs create template "Page Template" --template-type page-template'
      );
      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain(
        'Page template created successfully'
      );
    });

    it('should execute command with email template', async () => {
      mockAddFlag.mockReturnValueOnce(
        'hs create template "Email Template" --template-type email-template'
      );

      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Email template created successfully',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        userSuppliedName: 'Email Template',
        templateType: 'email-template',
      });

      expect(mockAddFlag).toHaveBeenCalledWith(
        'hs create template "Email Template"',
        'template-type',
        'email-template'
      );
      expect(result.content[0].text).toContain(
        'Email template created successfully'
      );
    });

    it('should execute command with partial template', async () => {
      mockAddFlag.mockReturnValueOnce(
        'hs create template "Header Partial" --template-type partial'
      );

      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Partial template created successfully',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        userSuppliedName: 'Header Partial',
        templateType: 'partial',
      });

      expect(mockAddFlag).toHaveBeenCalledWith(
        'hs create template "Header Partial"',
        'template-type',
        'partial'
      );
      expect(result.content[0].text).toContain(
        'Partial template created successfully'
      );
    });

    it('should execute command with blog-listing-template', async () => {
      mockAddFlag.mockReturnValueOnce(
        'hs create template "Blog Listing" --template-type blog-listing-template'
      );

      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Blog listing template created successfully',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        userSuppliedName: 'Blog Listing',
        templateType: 'blog-listing-template',
      });

      expect(mockAddFlag).toHaveBeenCalledWith(
        'hs create template "Blog Listing"',
        'template-type',
        'blog-listing-template'
      );
      expect(result.content[0].text).toContain(
        'Blog listing template created successfully'
      );
    });

    it('should execute command with destination path', async () => {
      mockAddFlag.mockReturnValueOnce(
        'hs create template "Test Template" "templates/custom" --template-type page-template'
      );

      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Template created at custom path',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        userSuppliedName: 'Test Template',
        dest: 'templates/custom',
        templateType: 'page-template',
      });

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/dir',
        expect.stringContaining('"templates/custom"')
      );
      expect(result.content[0].text).toContain(
        'Template created at custom path'
      );
    });

    it('should execute command with section template', async () => {
      mockAddFlag.mockReturnValueOnce(
        'hs create template "Hero Section" --template-type section'
      );

      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Section template created successfully',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        userSuppliedName: 'Hero Section',
        templateType: 'section',
      });

      expect(mockAddFlag).toHaveBeenCalledWith(
        'hs create template "Hero Section"',
        'template-type',
        'section'
      );
      expect(result.content[0].text).toContain(
        'Section template created successfully'
      );
    });

    it('should execute command with search template', async () => {
      mockAddFlag.mockReturnValueOnce(
        'hs create template "Search Results" --template-type search-template'
      );

      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Search template created successfully',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        userSuppliedName: 'Search Results',
        templateType: 'search-template',
      });

      expect(mockAddFlag).toHaveBeenCalledWith(
        'hs create template "Search Results"',
        'template-type',
        'search-template'
      );
      expect(result.content[0].text).toContain(
        'Search template created successfully'
      );
    });

    it('should execute command with blog-post-template', async () => {
      mockAddFlag.mockReturnValueOnce(
        'hs create template "Custom Blog Post" --template-type blog-post-template'
      );

      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Blog post template created successfully',
        stderr: '',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        userSuppliedName: 'Custom Blog Post',
        templateType: 'blog-post-template',
      });

      expect(mockAddFlag).toHaveBeenCalledWith(
        'hs create template "Custom Blog Post"',
        'template-type',
        'blog-post-template'
      );
      expect(result.content[0].text).toContain(
        'Blog post template created successfully'
      );
    });

    it('should handle command execution errors', async () => {
      mockRunCommandInDir.mockRejectedValue(
        new Error('Template creation failed')
      );

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        userSuppliedName: 'Test Template',
        templateType: 'page-template',
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain('Template creation failed');
    });

    it('should handle stderr output', async () => {
      mockAddFlag.mockReturnValueOnce(
        'hs create template "Test Template" --template-type page-template'
      );

      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Template created successfully',
        stderr: 'Warning: Using deprecated template syntax',
      });

      const result = await tool.handler({
        absoluteCurrentWorkingDirectory: '/test/dir',
        userSuppliedName: 'Test Template',
        templateType: 'page-template',
      });

      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('Template created successfully');
      expect(result.content[1].text).toContain(
        'Warning: Using deprecated template syntax'
      );
    });
  });
});

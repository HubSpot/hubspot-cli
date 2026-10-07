import { MockedFunction, Mocked } from 'vitest';
import { UploadProjectTools } from '../UploadProjectTools.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../../utils/logger.js';
import { getAllHsProfiles } from '@hubspot/project-parsing-lib/profiles';
import { getProjectConfig } from '../../../../lib/projects/config.js';
import { loadProfile } from '../../../../lib/projects/projectProfiles.js';
import { runCommandInDir } from '../../../utils/command.js';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';
import { discoverAccountTargets } from '../../../../lib/accountTargetDiscovery.js';
import { getConfigAccountIfExists } from '@hubspot/local-dev-lib/config';
import { MCP_ELICITATION_TIMEOUT } from '../../../../lib/constants.js';
import {
  MOCK_PRODUCTION_TARGET,
  MOCK_SANDBOX_TARGET,
  getMockConfigAccount,
} from '../../../../lib/testUtils.js';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../../utils/logger.js');
vi.mock('@hubspot/project-parsing-lib/profiles');
vi.mock('../../../../lib/projects/config.js');
vi.mock('../../../../lib/projects/projectProfiles.js');
vi.mock('../../../utils/command', async importOriginal => {
  const mod =
    await importOriginal<typeof import('../../../utils/command.js')>();
  return { ...mod, runCommandInDir: vi.fn() };
});
vi.mock('../../../utils/feedbackTracking');
vi.mock('../../../../lib/accountTargetDiscovery.js');
vi.mock('@hubspot/local-dev-lib/config');

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

const mockDiscoverAccountTargets = vi.mocked(discoverAccountTargets);

describe('mcp-server/tools/project/UploadProjectTools', () => {
  let mockMcpServer: Mocked<McpServer>;
  let mockLogger: Mocked<McpLogger>;
  let tool: UploadProjectTools;
  let mockRegisteredTool: RegisteredTool;

  beforeEach(() => {
    mockMcpServer = {
      registerTool: vi.fn(),
      server: {
        getClientCapabilities: vi.fn(),
        elicitInput: vi.fn(),
      },
    } as unknown as Mocked<McpServer>;

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
    mockGetProjectConfig.mockReturnValue({
      projectConfig: {
        srcDir: 'src',
        name: 'test-project',
        platformVersion: '2025.2',
      },
      projectDir: '/test/project',
    });
    mockGetAllHsProfiles.mockResolvedValue([]);
    mockDiscoverAccountTargets.mockResolvedValue({
      candidates: [MOCK_SANDBOX_TARGET],
      recommended: MOCK_SANDBOX_TARGET,
    });
    vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({});
    vi.mocked(getConfigAccountIfExists).mockImplementation(
      getMockConfigAccount
    );
    vi.mocked(loadProfile).mockImplementation(
      (projectConfig, projectDir, profileName) => ({
        accountId:
          profileName === 'prod'
            ? MOCK_PRODUCTION_TARGET.accountId
            : MOCK_SANDBOX_TARGET.accountId,
        variables: {},
      })
    );

    tool = new UploadProjectTools(mockMcpServer, mockLogger);
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
          outputSchema: expect.any(Object),
        }),
        expect.any(Function)
      );
      expect(result).toBe(mockRegisteredTool);
    });
  });

  describe('handler', () => {
    const input = {
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
        expect.objectContaining({
          executable: 'hs',
          args: expect.arrayContaining([
            'project',
            'upload',
            '--force',
            'true',
            '--json',
            'true',
            '--message',
            'Test upload message',
          ]),
        }),
        expect.any(Function)
      );

      expect(result).toEqual({
        content: [
          { type: 'text', text: 'Project uploaded successfully' },
          {
            type: 'text',
            text: '\nIMPORTANT: If this project contains cards, remember that uploading does NOT make them live automatically. Cards must be manually added to a view in HubSpot to become visible to users.',
          },
        ],
        structuredContent: {},
      });
    });

    it('should return parsed JSON output as structuredContent', async () => {
      const uploadOutput = {
        targetAccount: {
          accountId: 12345,
          accountName: 'Test Account',
          accountType: 'STANDARD',
        },
        buildId: 42,
        deployId: 7,
      };
      mockRunCommandInDir.mockResolvedValue({
        stdout: JSON.stringify(uploadOutput, null, 2),
        stderr: '',
      });

      const result = await tool.handler(input);

      expect(result.structuredContent).toEqual(uploadOutput);
    });

    it('should fall back to empty structuredContent when output is not valid schema JSON', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: JSON.stringify({ buildId: 'not-a-number' }),
        stderr: '',
      });

      const result = await tool.handler(input);

      expect(result.structuredContent).toEqual({});
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

    it('should use force and message flags', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Project created and uploaded',
        stderr: '',
      });

      await tool.handler(input);

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/project',
        expect.objectContaining({
          executable: 'hs',
          args: expect.arrayContaining([
            'project',
            'upload',
            '--force',
            'true',
            '--message',
            'Test upload message',
          ]),
        }),
        expect.any(Function)
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
        expect.objectContaining({
          executable: 'hs',
          args: expect.arrayContaining([
            'project',
            'upload',
            '--force',
            'true',
            '--message',
            'Test upload message',
            '--profile',
            'dev',
          ]),
        }),
        expect.any(Function)
      );
    });

    it('should list the profiles when the client cannot show a pick list', async () => {
      mockGetAllHsProfiles.mockResolvedValue(['prod', 'dev']);

      const result = await tool.handler(input);

      expect(mockRunCommandInDir).not.toHaveBeenCalled();
      expect(result.content).toEqual([
        {
          type: 'text',
          text: 'Several profiles are available. Ask the user which to use, then call upload-project again with the profile argument set to one of these profile names: prod, dev. The profiles target these accounts: prod [111], dev [222].',
        },
      ]);
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toBeUndefined();
    });

    describe('profile selection', () => {
      beforeEach(() => {
        mockGetAllHsProfiles.mockResolvedValue(['prod', 'dev']);
        mockDiscoverAccountTargets.mockImplementation(async options => {
          const target =
            options?.profileName === 'prod'
              ? MOCK_PRODUCTION_TARGET
              : MOCK_SANDBOX_TARGET;
          return { candidates: [target], recommended: target };
        });
        vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({
          elicitation: { form: {} },
        });
        mockRunCommandInDir.mockResolvedValue({ stdout: '', stderr: '' });
      });

      it('should ask for the profile with the CLI labels and upload with the choice', async () => {
        vi.mocked(mockMcpServer.server.elicitInput).mockResolvedValue({
          action: 'accept',
          content: { selection: 'dev' },
        });

        await tool.handler(input);

        expect(mockMcpServer.server.elicitInput).toHaveBeenCalledTimes(1);
        expect(mockMcpServer.server.elicitInput).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Select the profile to use for the upload.',
            requestedSchema: expect.objectContaining({
              properties: {
                selection: expect.objectContaining({
                  enum: ['prod', 'dev'],
                  enumNames: ['prod [111]', 'dev [222]'],
                }),
              },
            }),
          }),
          expect.anything()
        );
        expect(mockDiscoverAccountTargets).toHaveBeenCalledWith(
          expect.objectContaining({ profileName: 'dev' })
        );
        expect(mockRunCommandInDir).toHaveBeenCalledTimes(1);
        expect(mockRunCommandInDir.mock.calls[0][1].args).toEqual(
          expect.arrayContaining(['--profile', 'dev'])
        );
      });

      it('should confirm after the user picks a production profile', async () => {
        vi.mocked(mockMcpServer.server.elicitInput)
          .mockResolvedValueOnce({
            action: 'accept',
            content: { selection: 'prod' },
          })
          .mockResolvedValueOnce({ action: 'accept', content: {} });

        await tool.handler(input);

        expect(mockMcpServer.server.elicitInput).toHaveBeenCalledTimes(2);
        expect(mockMcpServer.server.elicitInput).toHaveBeenLastCalledWith(
          expect.objectContaining({
            message:
              'Upload test-project to production account Prod Portal [standard] (111)?',
          }),
          expect.anything()
        );
        const { args } = mockRunCommandInDir.mock.calls[0][1];
        expect(args).toEqual(expect.arrayContaining(['--profile', 'prod']));
        expect(args).not.toContain('--account');
      });

      it('should use the only profile without asking', async () => {
        mockGetAllHsProfiles.mockResolvedValue(['dev']);

        await tool.handler(input);

        expect(mockMcpServer.server.elicitInput).not.toHaveBeenCalled();
        expect(mockRunCommandInDir.mock.calls[0][1].args).toEqual(
          expect.arrayContaining(['--profile', 'dev'])
        );
      });
    });

    it('should pin the upload to the recommended account', async () => {
      mockRunCommandInDir.mockResolvedValue({ stdout: '', stderr: '' });

      await tool.handler(input);

      expect(mockDiscoverAccountTargets).toHaveBeenCalledWith({
        projectDir: '/test/project',
        projectConfig: expect.objectContaining({ name: 'test-project' }),
        profileName: undefined,
      });
      expect(mockRunCommandInDir).toHaveBeenCalledTimes(1);
      expect(mockRunCommandInDir.mock.calls[0][1].args).toEqual(
        expect.arrayContaining(['--account', '222'])
      );
    });

    it('should pass the profile without pinning an account', async () => {
      mockRunCommandInDir.mockResolvedValue({ stdout: '', stderr: '' });

      await tool.handler({ ...input, profile: 'dev' });

      expect(mockDiscoverAccountTargets).toHaveBeenCalledWith(
        expect.objectContaining({ profileName: 'dev' })
      );
      const { args } = mockRunCommandInDir.mock.calls[0][1];
      expect(args).toEqual(expect.arrayContaining(['--profile', 'dev']));
      expect(args).not.toContain('--account');
    });

    it('should not pin an account when none is recommended', async () => {
      mockDiscoverAccountTargets.mockResolvedValue({
        candidates: [
          MOCK_SANDBOX_TARGET,
          { ...MOCK_SANDBOX_TARGET, accountId: 333 },
        ],
      });
      mockRunCommandInDir.mockResolvedValue({ stdout: '', stderr: '' });

      await tool.handler(input);

      expect(mockRunCommandInDir.mock.calls[0][1].args).not.toContain(
        '--account'
      );
    });

    it('should look up accounts from the project directory', async () => {
      let initCwdDuringDiscovery: string | undefined;
      mockDiscoverAccountTargets.mockImplementation(async () => {
        initCwdDuringDiscovery = process.env.INIT_CWD;
        return {
          candidates: [MOCK_SANDBOX_TARGET],
          recommended: MOCK_SANDBOX_TARGET,
        };
      });
      mockRunCommandInDir.mockResolvedValue({ stdout: '', stderr: '' });

      await tool.handler(input);

      expect(initCwdDuringDiscovery).toBe('/test/project');
    });

    it('should throw when the project config cannot be loaded', async () => {
      mockGetProjectConfig.mockImplementation(() => {
        throw new Error('Unable to locate a project configuration file');
      });

      await expect(tool.handler(input)).rejects.toThrow(
        'Unable to locate a project configuration file'
      );
      expect(mockRunCommandInDir).not.toHaveBeenCalled();
    });

    describe('production confirmation', () => {
      beforeEach(() => {
        mockDiscoverAccountTargets.mockResolvedValue({
          candidates: [MOCK_PRODUCTION_TARGET],
          recommended: MOCK_PRODUCTION_TARGET,
        });
        mockRunCommandInDir.mockResolvedValue({ stdout: '', stderr: '' });
      });

      it('should upload after the user confirms the production account', async () => {
        vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({
          elicitation: { form: {} },
        });
        vi.mocked(mockMcpServer.server.elicitInput).mockResolvedValue({
          action: 'accept',
          content: {},
        });

        await tool.handler(input);

        expect(mockMcpServer.server.elicitInput).toHaveBeenCalledTimes(1);
        expect(mockMcpServer.server.elicitInput).toHaveBeenCalledWith(
          expect.objectContaining({
            message:
              'Upload test-project to production account Prod Portal [standard] (111)?',
          }),
          { timeout: MCP_ELICITATION_TIMEOUT }
        );
        expect(mockRunCommandInDir).toHaveBeenCalledTimes(1);
        expect(mockRunCommandInDir.mock.calls[0][1].args).toEqual(
          expect.arrayContaining(['upload', '--account', '111'])
        );
      });

      it('should not upload when the user declines', async () => {
        vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({
          elicitation: { form: {} },
        });
        vi.mocked(mockMcpServer.server.elicitInput).mockResolvedValue({
          action: 'decline',
        });

        const result = await tool.handler(input);

        expect(mockRunCommandInDir).not.toHaveBeenCalled();
        expect(result.content[0].text).toContain(
          'so upload-project did not run'
        );
        expect(result.isError).toBe(true);
        expect(result.structuredContent).toBeUndefined();
      });

      it('should upload when the client cannot elicit and the user confirmed in the conversation', async () => {
        await tool.handler({ ...input, confirmProductionAccount: true });

        expect(mockRunCommandInDir).toHaveBeenCalledTimes(1);
        expect(mockRunCommandInDir.mock.calls[0][1].args).toEqual(
          expect.arrayContaining(['upload', '--account', '111'])
        );
      });
    });

    it('should handle empty stdout and stderr', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: '',
        stderr: '',
      });

      const result = await tool.handler(input);

      expect(result.content).toEqual([
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
        absoluteProjectPath: '/different/path/to/project',
        uploadMessage: 'Different test upload message',
      };

      await tool.handler(differentInput);

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/different/path/to/project',
        expect.objectContaining({
          executable: 'hs',
          args: expect.arrayContaining([
            'project',
            'upload',
            '--force',
            'true',
            '--message',
            'Different test upload message',
          ]),
        }),
        expect.any(Function)
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

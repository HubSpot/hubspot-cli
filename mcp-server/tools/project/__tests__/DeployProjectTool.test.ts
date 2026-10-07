import { DeployProjectTool } from '../DeployProjectTool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../../utils/logger.js';
import { runCommandInDir } from '../../../utils/command.js';
import { MockedFunction, Mocked } from 'vitest';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';
import { getProjectConfig } from '../../../../lib/projects/config.js';
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
vi.mock('../../../utils/command', async importOriginal => {
  const mod =
    await importOriginal<typeof import('../../../utils/command.js')>();
  return { ...mod, runCommandInDir: vi.fn() };
});
vi.mock('../../../utils/feedbackTracking');
vi.mock('../../../../lib/projects/config.js');
vi.mock('../../../../lib/accountTargetDiscovery.js');
vi.mock('@hubspot/local-dev-lib/config');

const mockMcpFeedbackRequest = mcpFeedbackRequest as MockedFunction<
  typeof mcpFeedbackRequest
>;

const mockRunCommandInDir = runCommandInDir as MockedFunction<
  typeof runCommandInDir
>;

const mockGetProjectConfig = vi.mocked(getProjectConfig);
const mockDiscoverAccountTargets = vi.mocked(discoverAccountTargets);

describe('mcp-server/tools/project/DeployProject', () => {
  let mockMcpServer: Mocked<McpServer>;
  let mockLogger: Mocked<McpLogger>;
  let tool: DeployProjectTool;
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
    mockDiscoverAccountTargets.mockResolvedValue({
      candidates: [MOCK_SANDBOX_TARGET],
      recommended: MOCK_SANDBOX_TARGET,
    });
    vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({});
    vi.mocked(getConfigAccountIfExists).mockImplementation(
      getMockConfigAccount
    );

    tool = new DeployProjectTool(mockMcpServer, mockLogger);
  });

  describe('register', () => {
    it('should register tool with correct parameters', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'deploy-project',
        expect.objectContaining({
          title: 'Deploy a build of HubSpot Project',
          description: expect.stringContaining(
            'Takes a build number and a project name and deploys that build of the project'
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
    const baseInput = {
      absoluteProjectPath: '/test/project',
    };

    it('should deploy project with specified build number', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Project deployed successfully',
        stderr: '',
      });

      const input = {
        ...baseInput,
        buildNumber: 123,
      };

      const result = await tool.handler(input);

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/project',
        expect.objectContaining({
          executable: 'hs',
          args: expect.arrayContaining([
            'project',
            'deploy',
            '--build',
            '123',
            '--json',
            'true',
          ]),
        }),
        expect.any(Function)
      );

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Project deployed successfully' }],
        structuredContent: {},
      });
    });

    it('should return parsed JSON output as structuredContent', async () => {
      const deployOutput = {
        deployId: 42,
      };
      mockRunCommandInDir.mockResolvedValue({
        stdout: JSON.stringify(deployOutput, null, 2),
        stderr: '',
      });

      const input = {
        ...baseInput,
        buildNumber: 123,
      };

      const result = await tool.handler(input);

      expect(result.structuredContent).toEqual(deployOutput);
    });

    it('should fall back to empty structuredContent when output is not valid schema JSON', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: JSON.stringify({ deployId: 'not-a-number' }),
        stderr: '',
      });

      const input = {
        ...baseInput,
        buildNumber: 123,
      };

      const result = await tool.handler(input);

      expect(result.structuredContent).toEqual({});
    });

    it('should prompt for build number when not provided', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Build 1: Created 2023-01-01\nBuild 2: Created 2023-01-02',
        stderr: '',
      });

      const result = await tool.handler(baseInput);

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/project',
        expect.objectContaining({
          executable: 'hs',
          args: expect.arrayContaining([
            'project',
            'list-builds',
            '--limit',
            '100',
          ]),
        }),
        expect.any(Function)
      );

      expect(result.content).toEqual([
        {
          type: 'text',
          text: expect.stringContaining(
            'Ask the user which build number they would like to deploy?'
          ),
        },
      ]);
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toBeUndefined();

      expect(result.content[0].text).toContain('Build 1: Created 2023-01-01');
    });

    it('should handle deployment with stderr', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Deployed successfully',
        stderr: 'Warning: deprecated feature used',
      });

      const input = {
        ...baseInput,
        buildNumber: 456,
      };

      const result = await tool.handler(input);

      expect(result.content).toEqual([
        { type: 'text', text: 'Deployed successfully' },
        { type: 'text', text: 'Warning: deprecated feature used' },
      ]);
    });

    it('should handle errors during list-builds command', async () => {
      const error = new Error('Failed to list builds');
      mockRunCommandInDir.mockRejectedValue(error);

      // The error would be thrown and caught by the calling code
      await expect(tool.handler(baseInput)).rejects.toThrow(
        'Failed to list builds'
      );
    });

    it('should handle errors during deploy command', async () => {
      const error = new Error('Deployment failed');
      mockRunCommandInDir.mockRejectedValue(error);

      const input = {
        ...baseInput,
        buildNumber: 789,
      };

      await expect(tool.handler(input)).rejects.toThrow('Deployment failed');
    });

    it('should prompt for build when buildNumber is 0 (falsy)', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Build 0: Initial build\nBuild 1: Latest build',
        stderr: '',
      });

      const input = {
        ...baseInput,
        buildNumber: 0, // This is falsy, so it will prompt
      };

      const result = await tool.handler(input);

      expect(mockRunCommandInDir).toHaveBeenCalledWith(
        '/test/project',
        expect.objectContaining({
          executable: 'hs',
          args: expect.arrayContaining([
            'project',
            'list-builds',
            '--limit',
            '100',
          ]),
        }),
        expect.any(Function)
      );

      expect(result.content[0].text).toContain(
        'Ask the user which build number they would like to deploy?'
      );
    });

    it('should pin list-builds and deploy to the recommended account', async () => {
      mockRunCommandInDir.mockResolvedValue({ stdout: '', stderr: '' });

      await tool.handler(baseInput);
      await tool.handler({ ...baseInput, buildNumber: 123 });

      expect(mockDiscoverAccountTargets).toHaveBeenCalledWith({
        projectDir: '/test/project',
        projectConfig: expect.objectContaining({ name: 'test-project' }),
      });
      expect(mockRunCommandInDir).toHaveBeenCalledTimes(2);
      const [listBuildsCall, deployCall] = mockRunCommandInDir.mock.calls;
      expect(listBuildsCall[1].args).toEqual(
        expect.arrayContaining(['list-builds', '--account', '222'])
      );
      expect(deployCall[1].args).toEqual(
        expect.arrayContaining(['deploy', '--account', '222'])
      );
    });

    it('should not pin an account when none is recommended', async () => {
      mockDiscoverAccountTargets.mockResolvedValue({
        candidates: [
          MOCK_SANDBOX_TARGET,
          { ...MOCK_SANDBOX_TARGET, accountId: 333 },
        ],
      });
      mockRunCommandInDir.mockResolvedValue({ stdout: '', stderr: '' });

      await tool.handler({ ...baseInput, buildNumber: 123 });

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

      await tool.handler({ ...baseInput, buildNumber: 123 });

      expect(initCwdDuringDiscovery).toBe('/test/project');
    });

    it('should throw when the project config cannot be loaded', async () => {
      mockGetProjectConfig.mockImplementation(() => {
        throw new Error('Unable to locate a project configuration file');
      });

      await expect(
        tool.handler({ ...baseInput, buildNumber: 123 })
      ).rejects.toThrow('Unable to locate a project configuration file');
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

      it('should not ask for confirmation to list builds', async () => {
        vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({
          elicitation: { form: {} },
        });

        await tool.handler(baseInput);

        expect(mockMcpServer.server.elicitInput).not.toHaveBeenCalled();
      });

      it('should deploy after the user confirms the production account', async () => {
        vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({
          elicitation: { form: {} },
        });
        vi.mocked(mockMcpServer.server.elicitInput).mockResolvedValue({
          action: 'accept',
          content: {},
        });

        await tool.handler({ ...baseInput, buildNumber: 123 });

        expect(mockMcpServer.server.elicitInput).toHaveBeenCalledTimes(1);
        expect(mockMcpServer.server.elicitInput).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining(
              'Deploy build #123 to production account Prod Portal [standard] (111)?'
            ),
          }),
          { timeout: MCP_ELICITATION_TIMEOUT }
        );
        expect(mockRunCommandInDir).toHaveBeenCalledTimes(1);
        expect(mockRunCommandInDir).toHaveBeenCalledWith(
          '/test/project',
          expect.objectContaining({
            args: expect.arrayContaining(['deploy', '--account', '111']),
          }),
          expect.any(Function)
        );
      });

      it('should not deploy when the user cancels', async () => {
        vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({
          elicitation: { form: {} },
        });
        vi.mocked(mockMcpServer.server.elicitInput).mockResolvedValue({
          action: 'cancel',
        });

        const result = await tool.handler({ ...baseInput, buildNumber: 123 });

        expect(mockRunCommandInDir).not.toHaveBeenCalled();
        expect(result.content[0].text).toContain(
          'so deploy-project did not run'
        );
        expect(result.isError).toBe(true);
        expect(result.structuredContent).toBeUndefined();
      });

      it('should deploy when the client cannot elicit and the user confirmed in the conversation', async () => {
        await tool.handler({
          ...baseInput,
          buildNumber: 123,
          confirmProductionAccount: true,
        });

        expect(mockRunCommandInDir).toHaveBeenCalledTimes(1);
        expect(mockRunCommandInDir.mock.calls[0][1].args).toEqual(
          expect.arrayContaining(['deploy', '--build', '123'])
        );
      });
    });
  });
});

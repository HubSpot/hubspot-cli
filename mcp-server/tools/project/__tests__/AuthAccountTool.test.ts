import { AuthAccountTool, AuthAccountInputSchema } from '../AuthAccountTool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../../utils/logger.js';
import { MockedFunction, Mocked } from 'vitest';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';
import { runCommandInDir, HubSpotCommand } from '../../../utils/command.js';
import * as configUtils from '../../../utils/config.js';
import * as toolUsageTracking from '../../../utils/toolUsageTracking.js';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../../utils/logger.js');
vi.mock('../../../utils/feedbackTracking');
vi.mock('../../../utils/config');
vi.mock('../../../utils/toolUsageTracking');
vi.mock('../../../utils/command', async () => {
  const actual = await vi.importActual<
    typeof import('../../../utils/command.js')
  >('../../../utils/command.js');
  return { ...actual, runCommandInDir: vi.fn() };
});

const mockMcpFeedbackRequest = mcpFeedbackRequest as MockedFunction<
  typeof mcpFeedbackRequest
>;
const mockRunCommandInDir = runCommandInDir as MockedFunction<
  typeof runCommandInDir
>;
const mockSetupHubSpotConfig = vi.spyOn(configUtils, 'setupHubSpotConfig');
const mockTrackToolUsage = vi.spyOn(toolUsageTracking, 'trackToolUsage');

const baseInput: AuthAccountInputSchema = {
  absoluteCurrentWorkingDirectory: '/test/dir',
};

describe('mcp-server/tools/project/AuthAccountTool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let mockLogger: Mocked<McpLogger>;
  let tool: AuthAccountTool;
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
    mockSetupHubSpotConfig.mockImplementation(() => undefined);
    mockRunCommandInDir.mockResolvedValue({
      stdout: 'Account authenticated.',
      stderr: '',
    });
    mockTrackToolUsage.mockResolvedValue(undefined);

    tool = new AuthAccountTool(mockMcpServer, mockLogger);
  });

  describe('register', () => {
    it('registers with the correct tool name and title', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'auth-account',
        expect.objectContaining({
          title: 'Authenticate a HubSpot Account',
          description: expect.stringContaining('hs account auth'),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function)
      );
      expect(result).toBe(mockRegisteredTool);
    });
  });

  describe('handler', () => {
    function getCommandArgs(): string[] {
      const commandArg = mockRunCommandInDir.mock.calls[0][1] as HubSpotCommand;
      return commandArg.args;
    }

    it('runs hs account auth', async () => {
      await tool.handler(baseInput);

      expect(mockRunCommandInDir).toHaveBeenCalled();
      const args = getCommandArgs();
      expect(args).toContain('account');
      expect(args).toContain('auth');
    });

    it('adds --use-default-name when no name is provided', async () => {
      await tool.handler(baseInput);

      expect(getCommandArgs()).toContain('--use-default-name');
    });

    it('adds --name instead of --use-default-name when name is provided', async () => {
      await tool.handler({ ...baseInput, name: 'MyPortal' });

      const args = getCommandArgs();
      expect(args).toContain('--name');
      expect(args).toContain('MyPortal');
      expect(args).not.toContain('--use-default-name');
    });

    it('adds --default true by default', async () => {
      await tool.handler(baseInput);

      const args = getCommandArgs();
      expect(args).toContain('--default');
      expect(args).toContain('true');
    });

    it('adds --default false when setAsDefault is false', async () => {
      await tool.handler({ ...baseInput, setAsDefault: false });

      const args = getCommandArgs();
      expect(args).toContain('--default');
      expect(args).toContain('false');
    });

    it('adds --account when accountId is provided', async () => {
      await tool.handler({ ...baseInput, accountId: 99999 });

      const args = getCommandArgs();
      expect(args).toContain('--account');
      expect(args).toContain('99999');
    });

    it('returns stdout and stderr from the command', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Success!',
        stderr: 'Warning: something minor',
      });

      const result = await tool.handler(baseInput);

      expect(result.content[0].text).toBe('Success!');
      expect(result.content[1].text).toBe('Warning: something minor');
    });

    it('returns error message when runCommandInDir throws', async () => {
      mockRunCommandInDir.mockRejectedValue(new Error('Auth failed'));

      const result = await tool.handler(baseInput);

      expect(result.content[0].text).toContain('Auth failed');
    });

    it('calls setupHubSpotConfig with the provided working directory', async () => {
      await tool.handler({
        ...baseInput,
        absoluteCurrentWorkingDirectory: '/my/project',
      });

      expect(mockSetupHubSpotConfig).toHaveBeenCalledWith('/my/project');
    });
  });
});

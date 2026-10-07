import { AuthAccountTool, AuthAccountInputSchema } from '../AuthAccountTool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../../utils/logger.js';
import { MockedFunction, Mocked } from 'vitest';
import { getCurrentDefaultAccount } from '../../../../lib/accountAuth.js';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';
import { runCommandInDir, HubSpotCommand } from '../../../utils/command.js';
import * as configUtils from '../../../utils/config.js';
import * as toolUsageTracking from '../../../utils/toolUsageTracking.js';
import { MCP_ELICITATION_TIMEOUT } from '../../../../lib/constants.js';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../../../lib/accountAuth.js');
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
const mockGetCurrentDefaultAccount = vi.mocked(getCurrentDefaultAccount);
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
    mockSetupHubSpotConfig.mockImplementation(() => undefined);
    mockRunCommandInDir.mockResolvedValue({
      stdout: 'Account authenticated.',
      stderr: '',
    });
    mockTrackToolUsage.mockResolvedValue(undefined);
    mockGetCurrentDefaultAccount.mockReturnValue(undefined);

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
          outputSchema: expect.any(Object),
        }),
        expect.any(Function)
      );
      expect(result).toBe(mockRegisteredTool);
    });
  });

  describe('handler', () => {
    const existingDefault = {
      accountId: 12345,
      name: 'current-default',
    } as HubSpotConfigAccount;

    function getCommandArgs(): string[] {
      const commandArg = mockRunCommandInDir.mock.calls[0][1] as HubSpotCommand;
      return commandArg.args;
    }

    function getDefaultFlagValue(): string {
      const args = getCommandArgs();
      return args[args.indexOf('--default') + 1];
    }

    function enableElicitation(): void {
      mockGetCurrentDefaultAccount.mockReturnValue(existingDefault);
      vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({
        elicitation: { form: {} },
      });
    }

    it('runs hs account auth', async () => {
      await tool.handler(baseInput);

      expect(mockRunCommandInDir).toHaveBeenCalled();
      const args = getCommandArgs();
      expect(args).toContain('account');
      expect(args).toContain('auth');
    });

    it('runs the command with --json', async () => {
      await tool.handler(baseInput);

      expect(getCommandArgs()).toContain('--json');
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

    it('adds --default true without eliciting when setAsDefault is true', async () => {
      mockGetCurrentDefaultAccount.mockReturnValue(existingDefault);
      vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({
        elicitation: { form: {} },
      });

      await tool.handler({ ...baseInput, setAsDefault: true });

      expect(mockMcpServer.server.elicitInput).not.toHaveBeenCalled();
      expect(getDefaultFlagValue()).toBe('true');
    });

    it('adds --default false when setAsDefault is false', async () => {
      await tool.handler({ ...baseInput, setAsDefault: false });

      const args = getCommandArgs();
      expect(args).toContain('--default');
      expect(args).toContain('false');
    });

    describe('when another account is already the default', () => {
      it('elicits whether to replace the default account', async () => {
        enableElicitation();
        vi.mocked(mockMcpServer.server.elicitInput).mockResolvedValue({
          action: 'accept',
          content: { setAsDefault: true },
        });

        await tool.handler(baseInput);

        expect(mockMcpServer.server.elicitInput).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('current-default'),
            requestedSchema: expect.objectContaining({
              properties: {
                setAsDefault: expect.objectContaining({ type: 'boolean' }),
              },
              required: ['setAsDefault'],
            }),
          }),
          { timeout: MCP_ELICITATION_TIMEOUT }
        );
        expect(getDefaultFlagValue()).toBe('true');
      });

      it('adds --default false when the user unchecks set as default', async () => {
        enableElicitation();
        vi.mocked(mockMcpServer.server.elicitInput).mockResolvedValue({
          action: 'accept',
          content: { setAsDefault: false },
        });

        await tool.handler(baseInput);

        expect(getDefaultFlagValue()).toBe('false');
      });

      it.each(['decline', 'cancel'] as const)(
        'keeps the current default when the user chooses %s',
        async action => {
          enableElicitation();
          vi.mocked(mockMcpServer.server.elicitInput).mockResolvedValue({
            action,
          });

          await tool.handler(baseInput);

          expect(mockRunCommandInDir).toHaveBeenCalled();
          expect(getDefaultFlagValue()).toBe('false');
        }
      );

      it('adds --default true when the client cannot elicit', async () => {
        mockGetCurrentDefaultAccount.mockReturnValue(existingDefault);
        vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue(
          {}
        );

        await tool.handler(baseInput);

        expect(mockMcpServer.server.elicitInput).not.toHaveBeenCalled();
        expect(getDefaultFlagValue()).toBe('true');
      });

      it('does not elicit when re-authenticating the default account', async () => {
        enableElicitation();

        await tool.handler({
          ...baseInput,
          accountId: existingDefault.accountId,
        });

        expect(mockMcpServer.server.elicitInput).not.toHaveBeenCalled();
        expect(getDefaultFlagValue()).toBe('true');
      });
    });

    it('does not elicit when no default account exists', async () => {
      vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({
        elicitation: { form: {} },
      });

      await tool.handler(baseInput);

      expect(mockMcpServer.server.elicitInput).not.toHaveBeenCalled();
      expect(getDefaultFlagValue()).toBe('true');
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

    it('parses JSON stdout into structuredContent', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: JSON.stringify({
          accountId: 456789,
          accountName: 'test-account',
          authType: 'personalaccesskey',
        }),
        stderr: '',
      });

      const result = await tool.handler(baseInput);

      expect(result.structuredContent).toEqual({
        accountId: 456789,
        accountName: 'test-account',
        authType: 'personalaccesskey',
      });
    });

    it('omits structuredContent when stdout is not valid JSON', async () => {
      mockRunCommandInDir.mockResolvedValue({
        stdout: 'Account authenticated.',
        stderr: '',
      });

      const result = await tool.handler(baseInput);

      expect(result.structuredContent).toBeUndefined();
      expect(result.content[0].text).toBe('Account authenticated.');
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

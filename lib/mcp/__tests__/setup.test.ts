import { execAsync } from '../../../mcp-server/utils/command.js';
import { setupCodex, setupGemini, supportedTools } from '../setup.js';
import SpinniesManager from '../../ui/SpinniesManager.js';
import { logError } from '../../errorHandlers/index.js';
import { commands } from '../../../lang/en.js';

// Mock dependencies
vi.mock('../../../mcp-server/utils/command.js');
vi.mock('../../ui/SpinniesManager.js');
vi.mock('../../errorHandlers/index.js');
vi.mock('../../../lang/en.js', () => ({
  commands: {
    mcp: {
      setup: {
        codex: 'Codex CLI',
        claudeCode: 'Claude Code',
        cursor: 'Cursor',
        gemini: 'Gemini CLI',
        vsCode: 'VS Code',
        windsurf: 'Windsurf',
        success: vi.fn(targets => `Success message for ${targets.join(', ')}`),
        spinners: {
          configuringCodex: 'Configuring Codex...',
          configuredCodex: 'Configured Codex',
          codexNotFound: 'Codex command not found - skipping configuration',
          codexInstallFailed: 'Failed to configure Codex',
          configuringGemini: 'Configuring Gemini CLI...',
          configuredGemini: 'Configured Gemini CLI',
          geminiNotFound: 'Gemini CLI not found - skipping configuration',
          geminiInstallFailed: 'Failed to configure Gemini CLI',
        },
      },
    },
  },
}));

const mockedExecAsync = vi.mocked(execAsync);
const mockedSpinniesManager = vi.mocked(SpinniesManager);
const mockedLogError = vi.mocked(logError);

describe('lib/mcp/setup', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('supportedTools', () => {
    it('should include Codex in the supported tools list', () => {
      const codexTool = supportedTools.find(tool => tool.value === 'codex');
      expect(codexTool).toBeDefined();
      expect(codexTool?.name).toBe(commands.mcp.setup.codex);
      expect(codexTool?.value).toBe('codex');
    });

    it('should have Codex as the first tool in the list', () => {
      expect(supportedTools[0].value).toBe('codex');
    });

    it('should contain all expected tools', () => {
      const toolValues = supportedTools.map(tool => tool.value);
      expect(toolValues).toContain('codex');
      expect(toolValues).toContain('claude');
      expect(toolValues).toContain('cursor');
      expect(toolValues).toContain('gemini');
      expect(toolValues).toContain('vscode');
      expect(toolValues).toContain('windsurf');
    });

    it('should include Gemini in the supported tools list', () => {
      const geminiTool = supportedTools.find(tool => tool.value === 'gemini');
      expect(geminiTool).toBeDefined();
      expect(geminiTool?.name).toBe(commands.mcp.setup.gemini);
      expect(geminiTool?.value).toBe('gemini');
    });
  });

  describe('setupCodex', () => {
    const mockMcpCommand = {
      command: 'test-command',
      args: ['--arg1', '--arg2'],
    };

    it('should successfully configure Codex when command is available', async () => {
      mockedExecAsync.mockResolvedValueOnce({
        stdout: 'codex version 1.0.0',
        stderr: '',
      }); // version check
      mockedExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' }); // mcp add command

      const result = await setupCodex(mockMcpCommand);

      expect(result).toBe(true);
      expect(mockedSpinniesManager.add).toHaveBeenCalledWith('codexSpinner', {
        text: commands.mcp.setup.spinners.configuringCodex,
      });
      expect(mockedExecAsync).toHaveBeenCalledWith('codex --version');
      expect(mockedExecAsync).toHaveBeenCalledWith(
        'codex mcp add "HubSpotDev" -- test-command --arg1 --arg2 --ai-agent codex'
      );
      expect(mockedSpinniesManager.succeed).toHaveBeenCalledWith(
        'codexSpinner',
        {
          text: commands.mcp.setup.spinners.configuredCodex,
        }
      );
    });

    it('should use default mcp command when none provided', async () => {
      mockedExecAsync.mockResolvedValueOnce({
        stdout: 'codex version 1.0.0',
        stderr: '',
      }); // version check
      mockedExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' }); // mcp add command

      const result = await setupCodex();

      expect(result).toBe(true);
      expect(mockedExecAsync).toHaveBeenCalledWith(
        'codex mcp add "HubSpotDev" -- hs mcp start --ai-agent codex'
      );
    });

    it('should handle codex command not found', async () => {
      const error = new Error('Command not found: codex');
      mockedExecAsync.mockRejectedValueOnce(error);

      const result = await setupCodex(mockMcpCommand);

      expect(result).toBe(false);
      expect(mockedSpinniesManager.fail).toHaveBeenCalledWith('codexSpinner', {
        text: commands.mcp.setup.spinners.codexNotFound,
      });
    });

    it('should handle codex installation failure', async () => {
      const error = new Error('Some other error');
      mockedExecAsync.mockResolvedValueOnce({
        stdout: 'codex version 1.0.0',
        stderr: '',
      }); // version check passes
      mockedExecAsync.mockRejectedValueOnce(error); // mcp add fails

      const result = await setupCodex(mockMcpCommand);

      expect(result).toBe(false);
      expect(mockedSpinniesManager.fail).toHaveBeenCalledWith('codexSpinner', {
        text: commands.mcp.setup.spinners.codexInstallFailed,
      });
      expect(mockedLogError).toHaveBeenCalledWith(error);
    });

    it('should handle unexpected errors during spinner setup', async () => {
      const error = new Error('Unexpected error');
      mockedSpinniesManager.add.mockImplementationOnce(() => {
        throw error;
      });

      const result = await setupCodex(mockMcpCommand);

      expect(result).toBe(false);
      expect(mockedSpinniesManager.fail).toHaveBeenCalledWith('codexSpinner', {
        text: commands.mcp.setup.spinners.codexInstallFailed,
      });
      expect(mockedLogError).toHaveBeenCalledWith(error);
    });
  });

  describe('setupGemini', () => {
    const mockMcpCommand = {
      command: 'test-command',
      args: ['--arg1', '--arg2'],
    };

    it('should successfully configure Gemini CLI when command is available', async () => {
      mockedExecAsync.mockResolvedValueOnce({
        stdout: 'gemini version 1.0.0',
        stderr: '',
      });
      mockedExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await setupGemini(mockMcpCommand);

      expect(result).toBe(true);
      expect(mockedSpinniesManager.add).toHaveBeenCalledWith('geminiSpinner', {
        text: commands.mcp.setup.spinners.configuringGemini,
      });
      expect(mockedExecAsync).toHaveBeenCalledWith('gemini --version');
      expect(mockedExecAsync).toHaveBeenCalledWith(
        'gemini mcp add -s user "HubSpotDev" test-command --arg1 --arg2 --ai-agent gemini'
      );
      expect(mockedSpinniesManager.succeed).toHaveBeenCalledWith(
        'geminiSpinner',
        {
          text: commands.mcp.setup.spinners.configuredGemini,
        }
      );
    });

    it('should use default mcp command when none provided', async () => {
      mockedExecAsync.mockResolvedValueOnce({
        stdout: 'gemini version 1.0.0',
        stderr: '',
      });
      mockedExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await setupGemini();

      expect(result).toBe(true);
      expect(mockedExecAsync).toHaveBeenCalledWith(
        'gemini mcp add -s user "HubSpotDev" hs mcp start --ai-agent gemini'
      );
    });

    it('should handle gemini command not found', async () => {
      const error = new Error('Command not found: gemini');
      mockedExecAsync.mockRejectedValueOnce(error);

      const result = await setupGemini(mockMcpCommand);

      expect(result).toBe(false);
      expect(mockedSpinniesManager.fail).toHaveBeenCalledWith('geminiSpinner', {
        text: commands.mcp.setup.spinners.geminiNotFound,
      });
    });

    it('should handle gemini installation failure', async () => {
      const error = new Error('Some other error');
      mockedExecAsync.mockResolvedValueOnce({
        stdout: 'gemini version 1.0.0',
        stderr: '',
      });
      mockedExecAsync.mockRejectedValueOnce(error);

      const result = await setupGemini(mockMcpCommand);

      expect(result).toBe(false);
      expect(mockedSpinniesManager.fail).toHaveBeenCalledWith('geminiSpinner', {
        text: commands.mcp.setup.spinners.geminiInstallFailed,
      });
      expect(mockedLogError).toHaveBeenCalledWith(error);
    });
  });

  // Note: addMcpServerToConfig integration tests would require mocking many dependencies
  // and complex setup. The setupCodex function tests above cover the new functionality.
});

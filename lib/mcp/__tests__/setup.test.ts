import { execAsync } from '../../../mcp-server/utils/command.js';
import {
  setupCodex,
  setupGemini,
  setupClaudeCode,
  setupCursor,
  setupWindsurf,
  setupVsCode,
  addMcpServerToConfig,
  supportedTools,
} from '../setup.js';
import SpinniesManager from '../../ui/SpinniesManager.js';
import { logError } from '../../errorHandlers/index.js';
import { uiLogger } from '../../ui/logger.js';
import { promptUser } from '../../prompts/promptUtils.js';
import { commands } from '../../../lang/en.js';
import fs from 'fs-extra';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';

// Mock dependencies
vi.mock('../../../mcp-server/utils/command.js');
vi.mock('../../ui/SpinniesManager.js');
vi.mock('../../errorHandlers/index.js');
vi.mock('../../ui/logger.js');
vi.mock('../../prompts/promptUtils.js');
vi.mock('fs-extra');
vi.mock('fs');
vi.mock('os');
vi.mock('path');

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

    it('should pass through environment variables in command', async () => {
      const mockMcpCommandWithEnv = {
        command: 'test-command',
        args: ['--arg1'],
        env: { HUBSPOT_MCP_STANDALONE: 'true' },
      };
      mockedExecAsync.mockResolvedValueOnce({
        stdout: 'codex version 1.0.0',
        stderr: '',
      });
      mockedExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await setupCodex(mockMcpCommandWithEnv);

      expect(result).toBe(true);
      expect(mockedExecAsync).toHaveBeenCalledWith(
        'codex mcp add "HubSpotDev" --env HUBSPOT_MCP_STANDALONE="true" -- test-command --arg1 --ai-agent codex'
      );
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

  describe('setupClaudeCode', () => {
    const mockMcpCommand = {
      command: 'test-command',
      args: ['--arg1', '--arg2'],
    };

    it('should successfully configure Claude Code when command is available', async () => {
      mockedExecAsync
        .mockResolvedValueOnce({ stdout: 'claude version 1.0.0', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await setupClaudeCode(mockMcpCommand);

      expect(result).toBe(true);
      expect(mockedSpinniesManager.add).toHaveBeenCalledWith('claudeCode', {
        text: commands.mcp.setup.spinners.configuringClaudeCode,
      });
      expect(mockedExecAsync).toHaveBeenCalledWith('claude --version');
      expect(mockedExecAsync).toHaveBeenCalledWith('claude mcp list');
      expect(mockedSpinniesManager.succeed).toHaveBeenCalledWith('claudeCode', {
        text: commands.mcp.setup.spinners.configuredClaudeCode,
      });
    });

    it('should remove and re-add when server is already installed', async () => {
      mockedExecAsync
        .mockResolvedValueOnce({ stdout: 'claude version 1.0.0', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'HubSpotDev some-config', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await setupClaudeCode(mockMcpCommand);

      expect(result).toBe(true);
      expect(mockedSpinniesManager.update).toHaveBeenCalledWith('claudeCode', {
        text: commands.mcp.setup.spinners.alreadyInstalled,
      });
      expect(mockedExecAsync).toHaveBeenCalledWith(
        'claude mcp remove "HubSpotDev" --scope user'
      );
    });

    it('should use default mcp command when none provided', async () => {
      mockedExecAsync
        .mockResolvedValueOnce({ stdout: 'claude version 1.0.0', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await setupClaudeCode();

      expect(result).toBe(true);
      expect(mockedExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('claude mcp add-json "HubSpotDev"')
      );
    });

    it('should return false when claude command is not found', async () => {
      mockedExecAsync.mockRejectedValueOnce(
        new Error('claude: command not found')
      );

      const result = await setupClaudeCode(mockMcpCommand);

      expect(result).toBe(false);
      expect(mockedSpinniesManager.fail).toHaveBeenCalledWith('claudeCode', {
        text: commands.mcp.setup.spinners.claudeCodeNotFound,
      });
    });

    it('should return false and log error when mcp add fails', async () => {
      const error = new Error('mcp add failed');
      mockedExecAsync
        .mockResolvedValueOnce({ stdout: 'claude version 1.0.0', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockRejectedValueOnce(error);

      const result = await setupClaudeCode(mockMcpCommand);

      expect(result).toBe(false);
      expect(mockedSpinniesManager.fail).toHaveBeenCalledWith('claudeCode', {
        text: commands.mcp.setup.spinners.claudeCodeInstallFailed,
      });
      expect(mockedLogError).toHaveBeenCalledWith(error);
    });
  });

  describe('setupCursor', () => {
    const mockedFs = vi.mocked(fs);
    const mockedExistsSync = vi.mocked(existsSync);
    const mockMcpCommand = {
      command: 'test-command',
      args: ['--arg1'],
    };

    beforeEach(() => {
      vi.mocked(os.homedir).mockReturnValue('/home/user');
      vi.mocked(path.join).mockImplementation((...parts) => parts.join('/'));
    });

    it('should successfully configure Cursor when config file exists', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(
        JSON.stringify({ mcpServers: { existingServer: {} } })
      );

      const result = setupCursor(mockMcpCommand);

      expect(result).toBe(true);
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.cursor/mcp.json'),
        expect.stringContaining('HubSpotDev')
      );
      expect(mockedSpinniesManager.succeed).toHaveBeenCalledWith('spinner', {
        text: commands.mcp.setup.spinners.configuredCursor,
      });
    });

    it('should create config file when it does not exist', () => {
      mockedExistsSync.mockReturnValue(false);
      mockedFs.readFileSync.mockReturnValue('{}');

      const result = setupCursor(mockMcpCommand);

      expect(result).toBe(true);
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.cursor/mcp.json'),
        JSON.stringify({}, null, 2)
      );
    });

    it('should handle empty config file', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('   ');

      const result = setupCursor(mockMcpCommand);

      expect(result).toBe(true);
      const writeCall = mockedFs.writeFileSync.mock.calls.find(c =>
        (c[1] as string).includes('HubSpotDev')
      );
      expect(writeCall).toBeDefined();
    });

    it('should return false when config file has invalid JSON', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('not valid json {{{');

      const result = setupCursor(mockMcpCommand);

      expect(result).toBe(false);
      expect(mockedSpinniesManager.fail).toHaveBeenCalledWith('spinner', {
        text: commands.mcp.setup.spinners.failedToConfigureCursor,
      });
    });

    it('should return false when reading config file fails', () => {
      const error = new Error('Permission denied');
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementation(() => {
        throw error;
      });

      const result = setupCursor(mockMcpCommand);

      expect(result).toBe(false);
      expect(mockedSpinniesManager.fail).toHaveBeenCalledWith('spinner', {
        text: commands.mcp.setup.spinners.failedToConfigureCursor,
      });
      expect(mockedLogError).toHaveBeenCalledWith(error);
    });

    it('should use default mcp command when none provided', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('{}');

      const result = setupCursor();

      expect(result).toBe(true);
      const writeCall = mockedFs.writeFileSync.mock.calls.find(c =>
        (c[1] as string).includes('HubSpotDev')
      );
      const written = JSON.parse(writeCall![1] as string);
      expect(written.mcpServers.HubSpotDev.command).toBe('hs');
    });

    it('should initialize mcpServers when missing from existing config', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(
        JSON.stringify({ someOtherKey: true })
      );

      const result = setupCursor(mockMcpCommand);

      expect(result).toBe(true);
      const writeCall = mockedFs.writeFileSync.mock.calls.find(c =>
        (c[1] as string).includes('HubSpotDev')
      );
      const written = JSON.parse(writeCall![1] as string);
      expect(written.mcpServers).toBeDefined();
      expect(written.mcpServers.HubSpotDev).toBeDefined();
    });
  });

  describe('setupWindsurf', () => {
    const mockedFs = vi.mocked(fs);
    const mockedExistsSync = vi.mocked(existsSync);
    const mockMcpCommand = {
      command: 'test-command',
      args: ['--arg1'],
    };

    beforeEach(() => {
      vi.mocked(os.homedir).mockReturnValue('/home/user');
      vi.mocked(path.join).mockImplementation((...parts) => parts.join('/'));
    });

    it('should successfully configure Windsurf', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('{}');

      const result = setupWindsurf(mockMcpCommand);

      expect(result).toBe(true);
      expect(mockedSpinniesManager.add).toHaveBeenCalledWith('spinner', {
        text: commands.mcp.setup.spinners.configuringWindsurf,
      });
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.codeium/windsurf/mcp_config.json'),
        expect.stringContaining('HubSpotDev')
      );
      expect(mockedSpinniesManager.succeed).toHaveBeenCalledWith('spinner', {
        text: commands.mcp.setup.spinners.configuredWindsurf,
      });
    });

    it('should create config file when it does not exist', () => {
      mockedExistsSync.mockReturnValue(false);
      mockedFs.readFileSync.mockReturnValue('{}');

      const result = setupWindsurf(mockMcpCommand);

      expect(result).toBe(true);
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.codeium/windsurf/mcp_config.json'),
        JSON.stringify({}, null, 2)
      );
    });

    it('should return false on invalid JSON', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('{ invalid json');

      const result = setupWindsurf(mockMcpCommand);

      expect(result).toBe(false);
      expect(mockedSpinniesManager.fail).toHaveBeenCalledWith('spinner', {
        text: commands.mcp.setup.spinners.failedToConfigureWindsurf,
      });
    });

    it('should use default mcp command when none provided', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('{}');

      const result = setupWindsurf();

      expect(result).toBe(true);
      const writeCall = mockedFs.writeFileSync.mock.calls.find(c =>
        (c[1] as string).includes('HubSpotDev')
      );
      const written = JSON.parse(writeCall![1] as string);
      expect(written.mcpServers.HubSpotDev.command).toBe('hs');
    });
  });

  describe('setupVsCode', () => {
    const mockMcpCommand = {
      command: 'test-command',
      args: ['--arg1'],
    };

    it('should successfully configure VS Code', async () => {
      mockedExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await setupVsCode(mockMcpCommand);

      expect(result).toBe(true);
      expect(mockedSpinniesManager.add).toHaveBeenCalledWith('vsCode', {
        text: commands.mcp.setup.spinners.configuringVsCode,
      });
      expect(mockedExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('code --add-mcp')
      );
      expect(mockedSpinniesManager.succeed).toHaveBeenCalledWith('vsCode', {
        text: commands.mcp.setup.spinners.configuredVsCode,
      });
    });

    it('should use default mcp command when none provided', async () => {
      mockedExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await setupVsCode();

      expect(result).toBe(true);
      expect(mockedExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('code --add-mcp')
      );
    });

    it('should return false when code command is not found', async () => {
      mockedExecAsync.mockRejectedValueOnce(
        new Error('code: command not found')
      );

      const result = await setupVsCode(mockMcpCommand);

      expect(result).toBe(false);
      expect(mockedSpinniesManager.fail).toHaveBeenCalledWith('vsCode', {
        text: commands.mcp.setup.spinners.vsCodeNotFound,
      });
      expect(mockedLogError).not.toHaveBeenCalled();
    });

    it('should return false and log error on other failures', async () => {
      const error = new Error('Unexpected failure');
      mockedExecAsync.mockRejectedValueOnce(error);

      const result = await setupVsCode(mockMcpCommand);

      expect(result).toBe(false);
      expect(mockedSpinniesManager.fail).toHaveBeenCalledWith('vsCode', {
        text: commands.mcp.setup.spinners.failedToConfigureVsCode,
      });
      expect(mockedLogError).toHaveBeenCalledWith(error);
    });
  });

  describe('addMcpServerToConfig', () => {
    const mockedPromptUser = vi.mocked(promptUser);
    const mockedExistsSync = vi.mocked(existsSync);
    const mockedFs = vi.mocked(fs);
    const mockedUiLogger = vi.mocked(uiLogger);

    beforeEach(() => {
      vi.mocked(os.homedir).mockReturnValue('/home/user');
      vi.mocked(path.join).mockImplementation((...parts) => parts.join('/'));
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('{}');
    });

    it('should use provided targets without prompting', async () => {
      mockedPromptUser.mockResolvedValueOnce({ useStandaloneMode: false });
      mockedExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await addMcpServerToConfig(['cursor']);

      expect(result).toEqual(['cursor']);
      expect(mockedPromptUser).not.toHaveBeenCalledWith(
        expect.objectContaining({ name: 'selectedTargets' })
      );
    });

    it('should prompt for targets when none provided', async () => {
      mockedPromptUser
        .mockResolvedValueOnce({ selectedTargets: ['cursor'] })
        .mockResolvedValueOnce({ useStandaloneMode: false });
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('{}');

      const result = await addMcpServerToConfig(undefined);

      expect(result).toEqual(['cursor']);
      expect(mockedPromptUser).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'selectedTargets' })
      );
    });

    it('should prompt for targets when empty array provided', async () => {
      mockedPromptUser
        .mockResolvedValueOnce({ selectedTargets: ['windsurf'] })
        .mockResolvedValueOnce({ useStandaloneMode: false });
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('{}');

      const result = await addMcpServerToConfig([]);

      expect(result).toEqual(['windsurf']);
      expect(mockedPromptUser).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'selectedTargets' })
      );
    });

    it('should use npx command in standalone mode', async () => {
      mockedPromptUser
        .mockResolvedValueOnce({ useStandaloneMode: true })
        .mockResolvedValueOnce({ cliVersion: '' });
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('{}');

      const result = await addMcpServerToConfig(['cursor']);

      expect(result).toEqual(['cursor']);
      const writeCall = mockedFs.writeFileSync.mock.calls.find(c =>
        (c[1] as string).includes('HubSpotDev')
      );
      const written = JSON.parse(writeCall![1] as string);
      expect(written.mcpServers.HubSpotDev.command).toBe('npx');
      expect(written.mcpServers.HubSpotDev.env?.HUBSPOT_MCP_STANDALONE).toBe(
        'true'
      );
    });

    it('should pin version in standalone mode when version is provided', async () => {
      mockedPromptUser
        .mockResolvedValueOnce({ useStandaloneMode: true })
        .mockResolvedValueOnce({ cliVersion: '8.0.1' });
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('{}');

      const result = await addMcpServerToConfig(['cursor']);

      expect(result).toEqual(['cursor']);
      const writeCall = mockedFs.writeFileSync.mock.calls.find(c =>
        (c[1] as string).includes('HubSpotDev')
      );
      const written = JSON.parse(writeCall![1] as string);
      expect(written.mcpServers.HubSpotDev.args).toContain(
        '@hubspot/cli@8.0.1'
      );
      expect(written.mcpServers.HubSpotDev.env?.HUBSPOT_CLI_VERSION).toBe(
        '8.0.1'
      );
    });

    it('should call success logger after all targets are configured', async () => {
      mockedPromptUser.mockResolvedValueOnce({ useStandaloneMode: false });
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('{}');

      await addMcpServerToConfig(['cursor', 'windsurf']);

      expect(mockedUiLogger.info).toHaveBeenCalledWith(
        commands.mcp.setup.success(['cursor', 'windsurf'])
      );
    });

    it('should throw and fail spinner when setup function returns false', async () => {
      mockedPromptUser.mockResolvedValueOnce({ useStandaloneMode: false });
      const error = new Error('Permission denied');
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementation(() => {
        throw error;
      });

      await expect(addMcpServerToConfig(['cursor'])).rejects.toThrow();
      expect(mockedSpinniesManager.fail).toHaveBeenCalledWith('mcpSetup', {
        text: commands.mcp.setup.spinners.failedToConfigure,
      });
    });

    it('should configure multiple targets', async () => {
      mockedPromptUser.mockResolvedValueOnce({ useStandaloneMode: false });
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('{}');

      const result = await addMcpServerToConfig(['cursor', 'windsurf']);

      expect(result).toEqual(['cursor', 'windsurf']);
    });
  });
});

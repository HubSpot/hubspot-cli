import { execAsync } from '../../../mcp-server/utils/command.js';
import {
  setupCodex,
  setupClaudeCode,
  setupCursor,
  setupDevin,
  setupOpenCode,
  setupVsCode,
  configureMcpServer,
  supportedTools,
} from '../setup.js';
import SpinniesManager from '../../ui/SpinniesManager.js';
import { logError } from '../../errorHandlers/index.js';
import { uiLogger } from '../../ui/logger.js';
import { promptUser } from '../../prompts/promptUtils.js';
import { commands } from '../../../lang/en.js';
import { SKILLS_SOURCE_DIR, installSkills } from '../skills.js';
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
vi.mock('../skills.js', () => ({
  MCP_SKILLS: [
    { name: 'hubspot-new-app', description: 'New app skill' },
    { name: 'hubspot-fix-build', description: 'Fix build skill' },
  ],
  SKILLS_SOURCE_DIR: '/cli/mcp-server/skills',
  installSkills: vi.fn(),
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
      expect(toolValues).toContain('devin');
      expect(toolValues).toContain('opencode');
      expect(toolValues).toContain('vscode');
      expect(toolValues).toContain('other');
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

  describe('setupDevin', () => {
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

    it('should successfully configure Devin', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('{}');

      const result = setupDevin(mockMcpCommand);

      expect(result).toBe(true);
      expect(mockedSpinniesManager.add).toHaveBeenCalledWith('spinner', {
        text: commands.mcp.setup.spinners.configuringDevin,
      });
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.codeium/windsurf/mcp_config.json'),
        expect.stringContaining('HubSpotDev')
      );
      expect(mockedSpinniesManager.succeed).toHaveBeenCalledWith('spinner', {
        text: commands.mcp.setup.spinners.configuredDevin,
      });
    });

    it('should create config file when it does not exist', () => {
      mockedExistsSync.mockReturnValue(false);
      mockedFs.readFileSync.mockReturnValue('{}');

      const result = setupDevin(mockMcpCommand);

      expect(result).toBe(true);
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.codeium/windsurf/mcp_config.json'),
        JSON.stringify({}, null, 2)
      );
    });

    it('should return false on invalid JSON', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('{ invalid json');

      const result = setupDevin(mockMcpCommand);

      expect(result).toBe(false);
      expect(mockedSpinniesManager.fail).toHaveBeenCalledWith('spinner', {
        text: commands.mcp.setup.spinners.failedToConfigureDevin,
      });
    });

    it('should use default mcp command when none provided', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('{}');

      const result = setupDevin();

      expect(result).toBe(true);
      const writeCall = mockedFs.writeFileSync.mock.calls.find(c =>
        (c[1] as string).includes('HubSpotDev')
      );
      const written = JSON.parse(writeCall![1] as string);
      expect(written.mcpServers.HubSpotDev.command).toBe('hs');
    });
  });

  describe('setupOpenCode', () => {
    const mockMcpCommand = {
      command: 'test-command',
      args: ['--arg1', '--arg2'],
    };

    it('should successfully configure OpenCode when command is available', async () => {
      mockedExecAsync.mockResolvedValueOnce({
        stdout: 'opencode version 1.0.0',
        stderr: '',
      });
      mockedExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await setupOpenCode(mockMcpCommand);

      expect(result).toBe(true);
      expect(mockedSpinniesManager.add).toHaveBeenCalledWith(
        'openCodeSpinner',
        {
          text: commands.mcp.setup.spinners.configuringOpenCode,
        }
      );
      expect(mockedExecAsync).toHaveBeenCalledWith('opencode --version');
      expect(mockedExecAsync).toHaveBeenCalledWith(
        'opencode mcp add "HubSpotDev" -- test-command --arg1 --arg2 --ai-agent opencode'
      );
      expect(mockedSpinniesManager.succeed).toHaveBeenCalledWith(
        'openCodeSpinner',
        {
          text: commands.mcp.setup.spinners.configuredOpenCode,
        }
      );
    });

    it('should use default mcp command when none provided', async () => {
      mockedExecAsync.mockResolvedValueOnce({
        stdout: 'opencode version 1.0.0',
        stderr: '',
      });
      mockedExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await setupOpenCode();

      expect(result).toBe(true);
      expect(mockedExecAsync).toHaveBeenCalledWith(
        'opencode mcp add "HubSpotDev" -- hs mcp start --ai-agent opencode'
      );
    });

    it('should handle opencode command not found', async () => {
      const error = new Error('Command not found: opencode');
      mockedExecAsync.mockRejectedValueOnce(error);

      const result = await setupOpenCode(mockMcpCommand);

      expect(result).toBe(false);
      expect(mockedSpinniesManager.fail).toHaveBeenCalledWith(
        'openCodeSpinner',
        {
          text: commands.mcp.setup.spinners.openCodeNotFound,
        }
      );
    });

    it('should pass through environment variables in command', async () => {
      const mockMcpCommandWithEnv = {
        command: 'test-command',
        args: ['--arg1'],
        env: { HUBSPOT_MCP_STANDALONE: 'true' },
      };
      mockedExecAsync.mockResolvedValueOnce({
        stdout: 'opencode version 1.0.0',
        stderr: '',
      });
      mockedExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await setupOpenCode(mockMcpCommandWithEnv);

      expect(result).toBe(true);
      expect(mockedExecAsync).toHaveBeenCalledWith(
        'opencode mcp add "HubSpotDev" --env HUBSPOT_MCP_STANDALONE="true" -- test-command --arg1 --ai-agent opencode'
      );
    });

    it('should handle opencode installation failure', async () => {
      const error = new Error('Some other error');
      mockedExecAsync.mockResolvedValueOnce({
        stdout: 'opencode version 1.0.0',
        stderr: '',
      });
      mockedExecAsync.mockRejectedValueOnce(error);

      const result = await setupOpenCode(mockMcpCommand);

      expect(result).toBe(false);
      expect(mockedSpinniesManager.fail).toHaveBeenCalledWith(
        'openCodeSpinner',
        {
          text: commands.mcp.setup.spinners.openCodeInstallFailed,
        }
      );
      expect(mockedLogError).toHaveBeenCalledWith(error);
    });
  });

  describe('setupVsCode', () => {
    const mockMcpCommand = {
      command: 'test-command',
      args: ['--arg1'],
    };

    it('should successfully configure VS Code 1.99 or later', async () => {
      mockedExecAsync
        .mockResolvedValueOnce({ stdout: '1.99.0\ncommit\nx64', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await setupVsCode(mockMcpCommand);

      expect(result).toBe(true);
      expect(mockedSpinniesManager.add).toHaveBeenCalledWith('vsCode', {
        text: commands.mcp.setup.spinners.configuringVsCode,
      });
      expect(mockedExecAsync).toHaveBeenNthCalledWith(1, 'code --version');
      expect(mockedExecAsync).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('code --add-mcp')
      );
      expect(mockedSpinniesManager.succeed).toHaveBeenCalledWith('vsCode', {
        text: commands.mcp.setup.spinners.configuredVsCode,
      });
    });

    it('should use default mcp command when none provided', async () => {
      mockedExecAsync
        .mockResolvedValueOnce({ stdout: '1.99.0', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

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

    it('should return false when VS Code is below 1.99', async () => {
      mockedExecAsync.mockResolvedValueOnce({ stdout: '1.98.2', stderr: '' });

      const result = await setupVsCode(mockMcpCommand);

      expect(result).toBe(false);
      expect(mockedSpinniesManager.fail).toHaveBeenCalledWith('vsCode', {
        text: commands.mcp.setup.spinners.vsCodeVersionUnsupported,
      });
      expect(mockedExecAsync).toHaveBeenCalledTimes(1);
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
      expect(mockedExecAsync).toHaveBeenCalledTimes(1);
    });

    it('should return false and log error when adding MCP server fails', async () => {
      const error = new Error('Unexpected failure');
      mockedExecAsync
        .mockResolvedValueOnce({ stdout: '1.99.0', stderr: '' })
        .mockRejectedValueOnce(error);

      const result = await setupVsCode(mockMcpCommand);

      expect(result).toBe(false);
      expect(mockedSpinniesManager.fail).toHaveBeenCalledWith('vsCode', {
        text: commands.mcp.setup.spinners.failedToConfigureVsCode,
      });
      expect(mockedLogError).toHaveBeenCalledWith(error);
    });
  });

  describe('configureMcpServer', () => {
    const mockedPromptUser = vi.mocked(promptUser);
    const mockedExistsSync = vi.mocked(existsSync);
    const mockedFs = vi.mocked(fs);
    const mockedUiLogger = vi.mocked(uiLogger);
    const mockedInstallSkills = vi.mocked(installSkills);

    beforeEach(() => {
      mockedPromptUser.mockResolvedValue({ selectedSkills: [] });
      mockedInstallSkills.mockReturnValue(true);
      vi.mocked(os.homedir).mockReturnValue('/home/user');
      vi.mocked(path.join).mockImplementation((...parts) => parts.join('/'));
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('{}');
    });

    it('should use provided targets without prompting', async () => {
      mockedPromptUser.mockResolvedValueOnce({ useStandaloneMode: false });
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('{}');

      const result = await configureMcpServer({ targets: ['cursor'] });

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

      const result = await configureMcpServer({});

      expect(result).toEqual(['cursor']);
      expect(mockedPromptUser).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'selectedTargets' })
      );
    });

    it('should prompt for targets when empty array provided', async () => {
      mockedPromptUser
        .mockResolvedValueOnce({ selectedTargets: ['devin'] })
        .mockResolvedValueOnce({ useStandaloneMode: false });
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('{}');

      const result = await configureMcpServer({ targets: [] });

      expect(result).toEqual(['devin']);
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

      const result = await configureMcpServer({ targets: ['cursor'] });

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

    it('should skip standalone prompt when --standalone flag is provided', async () => {
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('{}');

      const result = await configureMcpServer({
        targets: ['cursor'],
        standalone: true,
        cliVersion: '',
      });

      expect(result).toEqual(['cursor']);
      expect(mockedPromptUser).not.toHaveBeenCalledWith(
        expect.objectContaining({ name: 'useStandaloneMode' })
      );
      const writeCall = mockedFs.writeFileSync.mock.calls.find(c =>
        (c[1] as string).includes('HubSpotDev')
      );
      const written = JSON.parse(writeCall![1] as string);
      expect(written.mcpServers.HubSpotDev.command).toBe('npx');
    });

    it('should skip standalone prompt when --no-standalone flag is provided', async () => {
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('{}');

      const result = await configureMcpServer({
        targets: ['cursor'],
        standalone: false,
        skills: [],
      });

      expect(result).toEqual(['cursor']);
      expect(mockedPromptUser).not.toHaveBeenCalled();
      const writeCall = mockedFs.writeFileSync.mock.calls.find(c =>
        (c[1] as string).includes('HubSpotDev')
      );
      const written = JSON.parse(writeCall![1] as string);
      expect(written.mcpServers.HubSpotDev.command).toBe('hs');
    });

    it('should skip cli version prompt when --cli-version flag is provided', async () => {
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('{}');

      const result = await configureMcpServer({
        targets: ['cursor'],
        standalone: true,
        cliVersion: '8.5.0',
        skills: [],
      });

      expect(result).toEqual(['cursor']);
      expect(mockedPromptUser).not.toHaveBeenCalled();
      const writeCall = mockedFs.writeFileSync.mock.calls.find(c =>
        (c[1] as string).includes('HubSpotDev')
      );
      const written = JSON.parse(writeCall![1] as string);
      expect(written.mcpServers.HubSpotDev.args).toContain(
        '@hubspot/cli@8.5.0'
      );
      expect(written.mcpServers.HubSpotDev.env?.HUBSPOT_CLI_VERSION).toBe(
        '8.5.0'
      );
    });

    it('should pin version in standalone mode when version is provided', async () => {
      mockedPromptUser
        .mockResolvedValueOnce({ useStandaloneMode: true })
        .mockResolvedValueOnce({ cliVersion: '8.0.1' });
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('{}');

      const result = await configureMcpServer({ targets: ['cursor'] });

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

      await configureMcpServer({ targets: ['cursor', 'devin'] });

      expect(mockedUiLogger.info).toHaveBeenCalledWith(
        commands.mcp.setup.success(['cursor', 'devin'])
      );
    });

    it('should throw and fail spinner when setup function returns false', async () => {
      mockedPromptUser.mockResolvedValueOnce({ useStandaloneMode: false });
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(
        configureMcpServer({ targets: ['cursor'] })
      ).rejects.toThrow();
      expect(mockedSpinniesManager.fail).toHaveBeenCalledWith('mcpSetup', {
        text: commands.mcp.setup.spinners.failedToConfigure,
      });
    });

    it('should configure multiple targets', async () => {
      mockedPromptUser.mockResolvedValueOnce({ useStandaloneMode: false });
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('{}');

      const result = await configureMcpServer({
        targets: ['cursor', 'devin'],
      });

      expect(result).toEqual(['cursor', 'devin']);
    });

    it('should return empty array, skip prompts and skills, and skip success message for other-only target', async () => {
      const result = await configureMcpServer({ targets: ['other'] });

      expect(result).toEqual([]);
      expect(mockedPromptUser).not.toHaveBeenCalled();
      expect(mockedInstallSkills).not.toHaveBeenCalled();
      expect(mockedUiLogger.info).not.toHaveBeenCalled();
      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        commands.mcp.setup.otherInstructions.header
      );
    });

    it('should exclude other from return value when mixed with real targets', async () => {
      mockedPromptUser.mockResolvedValueOnce({ useStandaloneMode: false });
      mockedExistsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('{}');

      const result = await configureMcpServer({
        targets: ['cursor', 'other'],
      });

      expect(result).toEqual(['cursor']);
      expect(mockedUiLogger.info).toHaveBeenCalledWith(
        commands.mcp.setup.success(['cursor'])
      );
      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        commands.mcp.setup.otherInstructions.header
      );
    });

    describe('skills', () => {
      it('should ask which skills to install, with none selected, when --skills is not provided', async () => {
        mockedPromptUser.mockResolvedValueOnce({
          selectedSkills: ['hubspot-new-app'],
        });

        await configureMcpServer({ targets: ['cursor'], standalone: false });

        expect(mockedPromptUser).toHaveBeenCalledTimes(1);
        expect(mockedPromptUser).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'selectedSkills',
            type: 'checkbox',
            message: commands.mcp.setup.prompts.selectSkills,
            choices: [
              {
                name: 'hubspot-new-app - New app skill',
                value: 'hubspot-new-app',
              },
              {
                name: 'hubspot-fix-build - Fix build skill',
                value: 'hubspot-fix-build',
              },
            ],
          })
        );
        expect(mockedInstallSkills).toHaveBeenCalledTimes(1);
        expect(mockedInstallSkills).toHaveBeenCalledWith(
          ['cursor'],
          ['hubspot-new-app']
        );
      });

      it('should not install skills when the user selects none', async () => {
        mockedPromptUser.mockResolvedValueOnce({ selectedSkills: [] });

        await configureMcpServer({ targets: ['cursor'], standalone: false });

        expect(mockedInstallSkills).not.toHaveBeenCalled();
      });

      it('should install the named skills without asking when --skills is provided', async () => {
        await configureMcpServer({
          targets: ['cursor', 'devin'],
          standalone: false,
          skills: ['hubspot-fix-build'],
        });

        expect(mockedPromptUser).not.toHaveBeenCalled();
        expect(mockedInstallSkills).toHaveBeenCalledTimes(1);
        expect(mockedInstallSkills).toHaveBeenCalledWith(
          ['cursor', 'devin'],
          ['hubspot-fix-build']
        );
      });

      it('should skip skills without asking when --skills has no names', async () => {
        await configureMcpServer({
          targets: ['cursor'],
          standalone: false,
          skills: [],
        });

        expect(mockedPromptUser).not.toHaveBeenCalled();
        expect(mockedInstallSkills).not.toHaveBeenCalled();
      });

      it('should only install skills for real clients when other is selected', async () => {
        await configureMcpServer({
          targets: ['cursor', 'other'],
          standalone: false,
          skills: ['hubspot-new-app'],
        });

        expect(mockedInstallSkills).toHaveBeenCalledTimes(1);
        expect(mockedInstallSkills).toHaveBeenCalledWith(
          ['cursor'],
          ['hubspot-new-app']
        );
      });

      it('should tell other tools where the skills are', async () => {
        await configureMcpServer({ targets: ['other'] });

        expect(mockedUiLogger.log).toHaveBeenCalledWith(
          commands.mcp.setup.otherInstructions.skillsNote(SKILLS_SOURCE_DIR)
        );
      });

      it('should throw and fail spinner when installing skills fails', async () => {
        mockedInstallSkills.mockReturnValue(false);

        await expect(
          configureMcpServer({
            targets: ['cursor'],
            standalone: false,
            skills: ['hubspot-new-app'],
          })
        ).rejects.toThrow();
        expect(mockedSpinniesManager.fail).toHaveBeenCalledTimes(1);
        expect(mockedSpinniesManager.fail).toHaveBeenCalledWith('mcpSetup', {
          text: commands.mcp.setup.spinners.failedToConfigure,
        });
      });

      it('should not install skills when an MCP setup fails', async () => {
        mockedFs.readFileSync.mockImplementation(() => {
          throw new Error('Permission denied');
        });

        await expect(
          configureMcpServer({
            targets: ['cursor'],
            standalone: false,
            skills: ['hubspot-new-app'],
          })
        ).rejects.toThrow();
        expect(mockedInstallSkills).not.toHaveBeenCalled();
      });
    });
  });
});

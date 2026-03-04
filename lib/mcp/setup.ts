import { uiLogger } from '../ui/logger.js';
import { commands } from '../../lang/en.js';
import { promptUser } from '../prompts/promptUtils.js';
import SpinniesManager from '../ui/SpinniesManager.js';
import { logError, getErrorMessage } from '../errorHandlers/index.js';
import { execAsync } from '../../mcp-server/utils/command.js';

import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { existsSync } from 'fs';

const mcpServerName = 'HubSpotDev';

const claudeCode = 'claude';
const windsurf = 'windsurf';
const cursor = 'cursor';
const vscode = 'vscode';
const codex = 'codex';
const gemini = 'gemini';

export const supportedTools = [
  { name: commands.mcp.setup.codex, value: codex },
  { name: commands.mcp.setup.claudeCode, value: claudeCode },
  { name: commands.mcp.setup.cursor, value: cursor },
  { name: commands.mcp.setup.gemini, value: gemini },
  { name: commands.mcp.setup.vsCode, value: vscode },
  { name: commands.mcp.setup.windsurf, value: windsurf },
];

interface McpCommand {
  command: string;
  args: string[];
}

const defaultMcpCommand: McpCommand = {
  command: 'hs',
  args: ['mcp', 'start'],
};

export async function addMcpServerToConfig(
  targets: string[] | undefined
): Promise<string[]> {
  try {
    let derivedTargets: string[] = [];
    if (!targets || targets.length === 0) {
      const { selectedTargets } = await promptUser({
        name: 'selectedTargets',
        type: 'checkbox',
        message: commands.mcp.setup.prompts.targets,
        choices: supportedTools,
        validate: (choices: string[]) => {
          return choices.length === 0
            ? commands.mcp.setup.prompts.targetsRequired
            : true;
        },
      });
      derivedTargets = selectedTargets;
    } else {
      derivedTargets = targets;
    }
    if (derivedTargets.includes(claudeCode)) {
      await runSetupFunction(setupClaudeCode);
    }

    if (derivedTargets.includes(cursor)) {
      await runSetupFunction(setupCursor);
    }

    if (derivedTargets.includes(windsurf)) {
      await runSetupFunction(setupWindsurf);
    }

    if (derivedTargets.includes(vscode)) {
      await runSetupFunction(setupVsCode);
    }

    if (derivedTargets.includes(codex)) {
      await runSetupFunction(setupCodex);
    }

    if (derivedTargets.includes(gemini)) {
      await runSetupFunction(setupGemini);
    }

    uiLogger.info(commands.mcp.setup.success(derivedTargets));

    return derivedTargets;
  } catch (error) {
    SpinniesManager.fail('mcpSetup', {
      text: commands.mcp.setup.spinners.failedToConfigure,
    });
    throw error;
  }
}

async function runSetupFunction(
  func: () => Promise<boolean> | boolean
): Promise<void> {
  const result = await func();
  if (!result) {
    throw new Error();
  }
}

interface SetupConfig {
  configPath: string;
  configuringMessage: string;
  configuredMessage: string;
  failedMessage: string;
  createDirectoryIfMissing?: boolean;
  mcpCommand: McpCommand;
}

function setupMcpConfigFile(config: SetupConfig): boolean {
  try {
    SpinniesManager.add('spinner', {
      text: config.configuringMessage,
    });

    if (!existsSync(config.configPath)) {
      fs.writeFileSync(config.configPath, JSON.stringify({}, null, 2));
    }

    let mcpConfig: { mcpServers?: Record<string, unknown> } = {};

    let configContent;
    try {
      configContent = fs.readFileSync(config.configPath, 'utf8');
    } catch (error) {
      SpinniesManager.fail('spinner', {
        text: config.failedMessage,
      });
      logError(error);
      return false;
    }

    try {
      // In the event the file exists, but is empty, initialize it to and empty object
      if (configContent.trim() === '') {
        mcpConfig = {};
      } else {
        mcpConfig = JSON.parse(configContent);
      }
    } catch (error) {
      SpinniesManager.fail('spinner', {
        text: config.failedMessage,
      });
      uiLogger.error(
        commands.mcp.setup.errors.errorParsingJsonFIle(
          config.configPath,
          getErrorMessage(error)
        )
      );
      return false;
    }

    // Initialize mcpServers if it doesn't exist
    if (!mcpConfig.mcpServers) {
      mcpConfig.mcpServers = {};
    }

    // Add or update HubSpot CLI MCP server
    mcpConfig.mcpServers[mcpServerName] = {
      ...config.mcpCommand,
    };

    // Write the updated config
    fs.writeFileSync(config.configPath, JSON.stringify(mcpConfig, null, 2));

    SpinniesManager.succeed('spinner', {
      text: config.configuredMessage,
    });
    return true;
  } catch (error) {
    SpinniesManager.fail('spinner', {
      text: config.failedMessage,
    });
    logError(error);
    return false;
  }
}

export async function setupVsCode(
  mcpCommand: McpCommand = defaultMcpCommand
): Promise<boolean> {
  try {
    SpinniesManager.add('vsCode', {
      text: commands.mcp.setup.spinners.configuringVsCode,
    });
    const mcpConfig = JSON.stringify({
      name: mcpServerName,
      ...buildCommandWithAgentString(mcpCommand, vscode),
    });

    await execAsync(`code --add-mcp ${JSON.stringify(mcpConfig)}`);

    SpinniesManager.succeed('vsCode', {
      text: commands.mcp.setup.spinners.configuredVsCode,
    });
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('code: command not found')
    ) {
      SpinniesManager.fail('vsCode', {
        text: commands.mcp.setup.spinners.vsCodeNotFound,
      });
    } else {
      SpinniesManager.fail('vsCode', {
        text: commands.mcp.setup.spinners.failedToConfigureVsCode,
      });
      logError(error);
    }
    return false;
  }
}

export async function setupClaudeCode(
  mcpCommand: McpCommand = defaultMcpCommand
): Promise<boolean> {
  try {
    SpinniesManager.add('claudeCode', {
      text: commands.mcp.setup.spinners.configuringClaudeCode,
    });

    try {
      // Check if claude command is available
      await execAsync('claude --version');
    } catch (e) {
      SpinniesManager.fail('claudeCode', {
        text: commands.mcp.setup.spinners.claudeCodeNotFound,
      });
      return false;
    }

    // Run claude mcp add command
    const mcpConfig = JSON.stringify({
      type: 'stdio',
      ...buildCommandWithAgentString(mcpCommand, claudeCode),
    });

    const { stdout } = await execAsync('claude mcp list');

    if (stdout.includes(mcpServerName)) {
      SpinniesManager.update('claudeCode', {
        text: commands.mcp.setup.spinners.alreadyInstalled,
      });
      await execAsync(`claude mcp remove "${mcpServerName}" --scope user`);
    }

    await execAsync(
      `claude mcp add-json "${mcpServerName}" ${JSON.stringify(mcpConfig)} --scope user`
    );

    SpinniesManager.succeed('claudeCode', {
      text: commands.mcp.setup.spinners.configuredClaudeCode,
    });
    return true;
  } catch (error) {
    SpinniesManager.fail('claudeCode', {
      text: commands.mcp.setup.spinners.claudeCodeInstallFailed,
    });
    logError(error);
    return false;
  }
}

export function setupCursor(
  mcpCommand: McpCommand = defaultMcpCommand
): boolean {
  const cursorConfigPath = path.join(os.homedir(), '.cursor', 'mcp.json');

  return setupMcpConfigFile({
    configPath: cursorConfigPath,
    configuringMessage: commands.mcp.setup.spinners.configuringCursor,
    configuredMessage: commands.mcp.setup.spinners.configuredCursor,
    failedMessage: commands.mcp.setup.spinners.failedToConfigureCursor,
    mcpCommand: buildCommandWithAgentString(mcpCommand, cursor),
  });
}

export function setupWindsurf(
  mcpCommand: McpCommand = defaultMcpCommand
): boolean {
  const windsurfConfigPath = path.join(
    os.homedir(),
    '.codeium',
    'windsurf',
    'mcp_config.json'
  );

  return setupMcpConfigFile({
    configPath: windsurfConfigPath,
    configuringMessage: commands.mcp.setup.spinners.configuringWindsurf,
    configuredMessage: commands.mcp.setup.spinners.configuredWindsurf,
    failedMessage: commands.mcp.setup.spinners.failedToConfigureWindsurf,
    mcpCommand: buildCommandWithAgentString(mcpCommand, windsurf),
  });
}

export async function setupCodex(
  mcpCommand: McpCommand = defaultMcpCommand
): Promise<boolean> {
  try {
    SpinniesManager.add('codexSpinner', {
      text: commands.mcp.setup.spinners.configuringCodex,
    });

    try {
      // Check if codex command is available
      await execAsync('codex --version');
    } catch (error) {
      SpinniesManager.fail('codexSpinner', {
        text: commands.mcp.setup.spinners.codexNotFound,
      });
      return false;
    }

    const mcpCommandWithAgent = buildCommandWithAgentString(mcpCommand, codex);

    await execAsync(
      `codex mcp add "${mcpServerName}" -- ${mcpCommandWithAgent.command} ${mcpCommandWithAgent.args.join(' ')}`
    );

    SpinniesManager.succeed('codexSpinner', {
      text: commands.mcp.setup.spinners.configuredCodex,
    });
    return true;
  } catch (error) {
    SpinniesManager.fail('codexSpinner', {
      text: commands.mcp.setup.spinners.codexInstallFailed,
    });
    logError(error);
    return false;
  }
}

export async function setupGemini(
  mcpCommand: McpCommand = defaultMcpCommand
): Promise<boolean> {
  try {
    SpinniesManager.add('geminiSpinner', {
      text: commands.mcp.setup.spinners.configuringGemini,
    });

    try {
      await execAsync('gemini --version');
    } catch (e) {
      SpinniesManager.fail('geminiSpinner', {
        text: commands.mcp.setup.spinners.geminiNotFound,
      });
      return false;
    }

    const mcpCommandWithAgent = buildCommandWithAgentString(mcpCommand, gemini);

    await execAsync(
      `gemini mcp add -s user "${mcpServerName}" ${mcpCommandWithAgent.command} ${mcpCommandWithAgent.args.join(' ')}`
    );

    SpinniesManager.succeed('geminiSpinner', {
      text: commands.mcp.setup.spinners.configuredGemini,
    });
    return true;
  } catch (error) {
    SpinniesManager.fail('geminiSpinner', {
      text: commands.mcp.setup.spinners.geminiInstallFailed,
    });
    logError(error);

    return false;
  }
}

function buildCommandWithAgentString(
  mcpCommand: McpCommand,
  agent: string
): McpCommand {
  const mcpCommandCopy = structuredClone(mcpCommand);
  mcpCommandCopy.args.push('--ai-agent', agent);
  return mcpCommandCopy;
}

import { ArgumentsCamelCase, Argv } from 'yargs';
import { spawn, ChildProcess } from 'node:child_process';
import path from 'path';
import fs from 'fs';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { commands } from '../../lang/en.js';
import { handleExit } from '../../lib/process.js';
import { CommonArgs, YargsCommandModule } from '../../types/Yargs.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { fileURLToPath } from 'url';

const command = 'start';
const describe = undefined; // Leave hidden for now

interface McpStartArgs extends CommonArgs {
  aiAgent: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function handler(args: ArgumentsCamelCase<McpStartArgs>): Promise<void> {
  try {
    await import('@modelcontextprotocol/sdk/server/mcp.js');
  } catch (e) {
    uiLogger.error(commands.mcp.start.errors.needsNode20);
    process.exit(EXIT_CODES.ERROR);
  }

  trackCommandUsage('mcp-start', {}, args.derivedAccountId);

  await startMcpServer(args.aiAgent);
}

async function startMcpServer(aiAgent?: string): Promise<void> {
  try {
    const serverPath = path.join(
      __dirname,
      '..',
      '..',
      'mcp-server',
      'server.js'
    );

    // Check if server file exists
    if (!fs.existsSync(serverPath)) {
      uiLogger.error(commands.mcp.start.errors.serverFileNotFound(serverPath));
      return;
    }

    uiLogger.debug(commands.mcp.start.startingServer);
    uiLogger.debug(commands.mcp.start.stopInstructions);

    const args: string[] = [serverPath];

    // Start the server using ts-node
    const child: ChildProcess = spawn(`node`, args, {
      stdio: 'inherit',
      env: {
        ...process.env,
        HUBSPOT_MCP_AI_AGENT: aiAgent || 'unknown',
      },
    });

    // Handle server process events
    child.on('error', error => {
      logError(error);
      uiLogger.error(commands.mcp.start.errors.failedToStart);
    });

    child.on('close', () => {
      uiLogger.info(commands.mcp.start.stoppedSuccessfully);
    });

    handleExit(() => {
      uiLogger.info(commands.mcp.start.shuttingDown);
      child.kill('SIGTERM');
      process.exit(EXIT_CODES.SUCCESS);
    });
  } catch (error) {
    uiLogger.error(commands.mcp.start.errors.failedToStart);
    logError(error);
  }
}

function startBuilder(yargs: Argv): Argv<McpStartArgs> {
  yargs.option('ai-agent', {
    type: 'string',
  });
  return yargs as Argv<McpStartArgs>;
}

const builder = makeYargsBuilder(startBuilder, command, describe, {
  useGlobalOptions: true,
});

const mcpStartCommand: YargsCommandModule<unknown, McpStartArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default mcpStartCommand;

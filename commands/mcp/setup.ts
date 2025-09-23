import { ArgumentsCamelCase, Argv } from 'yargs';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { CommonArgs, YargsCommandModule } from '../../types/Yargs.js';
import { addMcpServerToConfig, supportedTools } from '../../lib/mcp/setup.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { hasFeature } from '../../lib/hasFeature.js';
import { FEATURES } from '../../lib/constants.js';
import { uiBetaTag } from '../../lib/ui/index.js';

const command = ['setup'];
const describe = uiBetaTag(commands.mcp.setup.describe, false);

interface MCPSetupArgs extends CommonArgs {
  client?: string[];
}

async function handler(args: ArgumentsCamelCase<MCPSetupArgs>): Promise<void> {
  const { derivedAccountId } = args;

  const hasMcpAccess = await hasFeature(derivedAccountId, FEATURES.MCP_ACCESS);

  if (!hasMcpAccess) {
    uiLogger.error(commands.mcp.setup.errors.needsMcpAccess(derivedAccountId));
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    await import('@modelcontextprotocol/sdk/server/mcp.js');
  } catch (e) {
    uiLogger.error(commands.mcp.setup.errors.needsNode20);
    process.exit(EXIT_CODES.ERROR);
  }

  trackCommandUsage('mcp-setup', {}, args.derivedAccountId);

  try {
    await addMcpServerToConfig(args.client);
  } catch (e) {
    process.exit(EXIT_CODES.ERROR);
  }

  process.exit(EXIT_CODES.SUCCESS);
}

function setupBuilder(yargs: Argv): Argv<MCPSetupArgs> {
  yargs.option('client', {
    describe: commands.mcp.setup.args.client,
    type: 'array',
    choices: [...supportedTools.map(tool => tool.value)],
  });

  return yargs as Argv<MCPSetupArgs>;
}
const builder = makeYargsBuilder(setupBuilder, command, describe, {
  useGlobalOptions: true,
});

const mcpSetupCommand: YargsCommandModule<unknown, MCPSetupArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default mcpSetupCommand;

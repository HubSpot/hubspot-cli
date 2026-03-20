import { ArgumentsCamelCase, Argv } from 'yargs';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { commands } from '../../lang/en.js';
import { CommonArgs, YargsCommandModule } from '../../types/Yargs.js';
import { addMcpServerToConfig, supportedTools } from '../../lib/mcp/setup.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';

const command = ['setup'];
const describe = commands.mcp.setup.describe;

interface MCPSetupArgs extends CommonArgs {
  client?: string[];
}

async function handler(args: ArgumentsCamelCase<MCPSetupArgs>): Promise<void> {
  const { derivedAccountId } = args;

  await trackCommandUsage('mcp-setup', {}, derivedAccountId);

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

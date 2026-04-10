import { Argv, ArgumentsCamelCase } from 'yargs';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { commands } from '../../lang/en.js';
import { CommonArgs, YargsCommandModule } from '../../types/Yargs.js';
import { makeYargsHandlerWithUsageTracking } from '../../lib/yargs/makeYargsHandlerWithUsageTracking.js';
import { addMcpServerToConfig, supportedTools } from '../../lib/mcp/setup.js';

const command = ['setup'];
const describe = commands.mcp.setup.describe;

interface MCPSetupArgs extends CommonArgs {
  client?: string[];
}

async function handler(args: ArgumentsCamelCase<MCPSetupArgs>): Promise<void> {
  const { exit } = args;

  try {
    await addMcpServerToConfig(args.client);
  } catch (e) {
    return exit(EXIT_CODES.ERROR);
  }

  return exit(EXIT_CODES.SUCCESS);
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
  handler: makeYargsHandlerWithUsageTracking('mcp-setup', handler),
  builder,
};

export default mcpSetupCommand;

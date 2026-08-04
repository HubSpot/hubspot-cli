import { Argv, ArgumentsCamelCase } from 'yargs';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { commands } from '../../lang/en.js';
import { CommonArgs, YargsCommandModule } from '../../types/Yargs.js';
import { makeWrappedYargsHandler } from '../../lib/yargs/makeWrappedYargsHandler.js';
import { configureMcpServer, supportedTools } from '../../lib/mcp/setup.js';

const command = ['setup'];
const describe = commands.mcp.setup.describe;

interface MCPSetupArgs extends CommonArgs {
  client?: string[];
  standalone?: boolean;
  cliVersion?: string;
}

async function handler(args: ArgumentsCamelCase<MCPSetupArgs>): Promise<void> {
  const { exit } = args;

  try {
    await configureMcpServer({
      targets: args.client,
      standalone: args.standalone,
      cliVersion: args.cliVersion,
    });
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
  yargs.option('standalone', {
    describe: commands.mcp.setup.args.standalone,
    type: 'boolean',
  });
  yargs.option('cli-version', {
    describe: commands.mcp.setup.args.cliVersion,
    type: 'string',
  });

  yargs.check(argv => {
    if (argv.cliVersion !== undefined && argv.standalone !== true) {
      throw new Error(commands.mcp.setup.errors.cliVersionRequiresStandalone);
    }
    return true;
  });

  yargs.example([
    [
      '$0 mcp setup --client claude --no-standalone',
      commands.mcp.setup.examples.nonInteractive,
    ],
    [
      '$0 mcp setup --client cursor --standalone --cli-version 8.0.1',
      commands.mcp.setup.examples.standalone,
    ],
  ]);

  return yargs as Argv<MCPSetupArgs>;
}
const builder = makeYargsBuilder(setupBuilder, command, describe, {
  useGlobalOptions: true,
});

const mcpSetupCommand: YargsCommandModule<unknown, MCPSetupArgs> = {
  command,
  describe,
  handler: makeWrappedYargsHandler('mcp-setup', handler),
  builder,
};

export default mcpSetupCommand;

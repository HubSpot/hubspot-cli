import { Argv } from 'yargs';
import startCommand from './mcp/start.js';
import setupCommand from './mcp/setup.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { YargsCommandModuleBucket } from '../types/Yargs.js';
import { commands } from '../lang/en.js';

const command = 'mcp';
const describe = commands.mcp.describe;

function mcpBuilder(yargs: Argv): Argv {
  yargs.command(startCommand).command(setupCommand).demandCommand(1, '');

  return yargs;
}

const builder = makeYargsBuilder(mcpBuilder, command, describe, {
  useGlobalOptions: true,
});

const mcpCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default mcpCommand;

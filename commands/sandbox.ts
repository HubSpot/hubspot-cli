import { Argv } from 'yargs';
import { commands } from '../lang/en.js';
import { uiBetaTag } from '../lib/ui/index.js';
import create from './sandbox/create.js';
import del from './sandbox/delete.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { YargsCommandModuleBucket } from '../types/Yargs.js';

const command = ['sandbox', 'sandboxes'];
const describe = uiBetaTag(commands.sandbox.describe, false);

function sandboxBuilder(yargs: Argv): Argv {
  yargs.command(create).command(del).demandCommand(1, '');

  return yargs;
}

const builder = makeYargsBuilder(sandboxBuilder, command, describe);

const sandboxCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default sandboxCommand;

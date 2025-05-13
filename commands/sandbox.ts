import { Argv } from 'yargs';
import { i18n } from '../lib/lang';
import { uiBetaTag } from '../lib/ui';
import create from './sandbox/create';
import del from './sandbox/delete';
import { makeYargsBuilder } from '../lib/yargsUtils';
import { YargsCommandModuleBucket } from '../types/Yargs';

const command = ['sandbox', 'sandboxes'];
const describe = uiBetaTag(i18n(`commands.sandbox.describe`), false);

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

// TODO Remove this legacy export once we've migrated all commands to TS
module.exports = sandboxCommand;

import { Argv } from 'yargs';
import createCommand from './module/create.js';
import { commands } from '../../lang/en.js';
import { YargsCommandModuleBucket } from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = 'module';
const describe = commands.cms.subcommands.module.describe;

function moduleBuilder(yargs: Argv): Argv {
  yargs.command(createCommand).demandCommand(1, '');

  return yargs;
}

const builder = makeYargsBuilder(moduleBuilder, command, describe);

const moduleCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default moduleCommand;

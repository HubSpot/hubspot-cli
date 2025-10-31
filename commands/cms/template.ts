import { Argv } from 'yargs';
import createCommand from './template/create.js';
import { commands } from '../../lang/en.js';
import { YargsCommandModuleBucket } from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = 'template';
const describe = commands.cms.subcommands.template.describe;

function templateBuilder(yargs: Argv): Argv {
  yargs.command(createCommand).demandCommand(1, '');

  return yargs;
}

const builder = makeYargsBuilder(templateBuilder, command, describe);

const templateCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default templateCommand;

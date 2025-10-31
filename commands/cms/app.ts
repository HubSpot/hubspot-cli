import { Argv } from 'yargs';
import createCommand from './app/create.js';
import { commands } from '../../lang/en.js';
import { YargsCommandModuleBucket } from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = ['app', 'apps'];
const describe = commands.cms.subcommands.app.describe;

function appBuilder(yargs: Argv): Argv {
  yargs.command(createCommand).demandCommand(1, '');

  return yargs;
}

const builder = makeYargsBuilder(appBuilder, command, describe);

const appCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default appCommand;

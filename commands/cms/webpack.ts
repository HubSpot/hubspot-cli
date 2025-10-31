import { Argv } from 'yargs';
import createCommand from './webpack/create.js';
import { commands } from '../../lang/en.js';
import { YargsCommandModuleBucket } from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = 'webpack';
const describe = commands.cms.subcommands.webpack.describe;

function webpackBuilder(yargs: Argv): Argv {
  yargs.command(createCommand).demandCommand(1, '');

  return yargs;
}

const builder = makeYargsBuilder(webpackBuilder, command, describe);

const webpackCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default webpackCommand;

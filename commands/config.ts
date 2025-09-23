import { Argv } from 'yargs';
import { commands } from '../lang/en.js';
import set from './config/set.js';
import migrate from './config/migrate.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { YargsCommandModuleBucket } from '../types/Yargs.js';

const command = 'config';
const describe = commands.config.describe;

function configBuilder(yargs: Argv): Argv {
  yargs.command(set).command(migrate).demandCommand(1, '');

  return yargs;
}

const builder = makeYargsBuilder(configBuilder, command, describe);

const configCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default configCommand;

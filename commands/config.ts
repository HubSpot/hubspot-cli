import { Argv } from 'yargs';
import { i18n } from '../lib/lang';
import set from './config/set';
import migrate from './config/migrate';
import { makeYargsBuilder } from '../lib/yargsUtils';
import { YargsCommandModuleBucket } from '../types/Yargs';

const command = 'config';
const describe = i18n('commands.config.describe');

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

// TODO Remove this legacy export once we've migrated all commands to TS
module.exports = configCommand;

import { Argv } from 'yargs';
import { makeYargsBuilder } from '../lib/yargsUtils';
import { YargsCommandModuleBucket } from '../types/Yargs';
import migrateCommand from './app/migrate';

const command = ['app', 'apps'];
// Keep the command hidden for now
const describe = undefined;

function appBuilder(yargs: Argv) {
  return yargs.command(migrateCommand).demandCommand(1, '');
}

const builder = makeYargsBuilder(appBuilder, command, describe);

const appCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default appCommand;

// TODO Remove this legacy export once we've migrated all commands to TS
module.exports = appCommand;

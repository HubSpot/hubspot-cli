import { Argv } from 'yargs';
import migrateCommand from './app/migrate';
import appSecretCommand from './app/secret';
import { makeYargsBuilder } from '../lib/yargsUtils';
import { YargsCommandModuleBucket } from '../types/Yargs';

const command = ['app', 'apps'];
// Keep the command hidden for now
const describe = undefined;

function appBuilder(yargs: Argv) {
  yargs.command(migrateCommand).command(appSecretCommand).demandCommand(1, '');
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

// TODO Remove this legacy export once we've migrated all commands to TS
module.exports = appCommand;

import migrateCommand from './app/migrate';
import { addGlobalOptions } from '../lib/commonOpts';
import { Argv, CommandModule } from 'yargs';

export const command = ['app', 'apps'];

// Keep the command hidden for now
export const describe = undefined;

export function builder(yargs: Argv) {
  addGlobalOptions(yargs);

  return yargs.command(migrateCommand).demandCommand(1, '');
}

const appCommand: CommandModule = {
  command,
  describe,
  builder,
  handler: () => {},
};
export default appCommand;

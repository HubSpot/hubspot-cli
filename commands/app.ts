import * as migrateCommand from './app/migrate';
import { addGlobalOptions } from '../lib/commonOpts';
import { Argv } from 'yargs';

export const command = ['app', 'apps'];
export const describe = null;

export function builder(yargs: Argv) {
  addGlobalOptions(yargs);

  // @ts-ignore
  yargs.command(migrateCommand).demandCommand(1, '');

  return yargs;
}

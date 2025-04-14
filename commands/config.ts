import { Argv } from 'yargs';
import { addConfigOptions, addGlobalOptions } from '../lib/commonOpts';
import { i18n } from '../lib/lang';
import * as set from './config/set';
import * as migrate from './config/migrate';

export const command = 'config';
export const describe = i18n('commands.config.describe');

export function builder(yargs: Argv): Argv {
  addConfigOptions(yargs);
  addGlobalOptions(yargs);

  yargs.command(set).command(migrate).demandCommand(1, '');

  return yargs;
}

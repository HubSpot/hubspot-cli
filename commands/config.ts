import { Argv } from 'yargs';
import { addConfigOptions, addGlobalOptions } from '../lib/commonOpts';
import { i18n } from '../lib/lang';
const set = require('./config/set');
import * as migrate from './config/migrate';

const i18nKey = 'commands.config';

export const command = 'config';
export const describe = i18n(`${i18nKey}.describe`);

export function builder(yargs: Argv): Argv {
  addConfigOptions(yargs);
  addGlobalOptions(yargs);

  yargs.command(set).command(migrate).demandCommand(1, '');

  return yargs;
}

import { Argv } from 'yargs';
import { addGlobalOptions } from '../lib/commonOpts';
import list from './function/list';
const deploy = require('./function/deploy');
const server = require('./function/server');
import { i18n } from '../lib/lang';

export const command = ['function', 'functions'];
export const describe = i18n(`commands.function.describe`);

export function builder(yargs: Argv): Argv {
  addGlobalOptions(yargs);
  yargs.command(list).command(deploy).command(server).demandCommand(1, '');

  return yargs;
}

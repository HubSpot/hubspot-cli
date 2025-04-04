import { Argv } from 'yargs';
import { addGlobalOptions } from '../lib/commonOpts';
import { i18n } from '../lib/lang';
import * as list from './account/list';
import * as rename from './account/rename';
import * as use from './account/use';
import * as info from './account/info';
import * as remove from './account/remove';
import * as clean from './account/clean';

export const command = ['account', 'accounts'];
export const describe = i18n(`commands.account.describe`);

export function builder(yargs: Argv): Argv {
  addGlobalOptions(yargs);

  yargs
    .command(list)
    .command(rename)
    .command(use)
    .command(info)
    .command(remove)
    .command(clean)
    .demandCommand(1, '');

  return yargs;
}

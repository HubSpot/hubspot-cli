import { Argv } from 'yargs';
import { addGlobalOptions } from '../lib/commonOpts';
import { i18n } from '../lib/lang';
import * as auth from './account/auth';
import * as list from './account/list';
import * as rename from './account/rename';
import * as use from './account/use';
import * as info from './account/info';
import * as remove from './account/remove';
import * as clean from './account/clean';
import * as createOverride from './account/createOverride';
import * as removeOverride from './account/removeOverride';

const i18nKey = 'commands.account';

export const command = ['account', 'accounts'];
export const describe = i18n(`${i18nKey}.describe`);

export function builder(yargs: Argv): Argv {
  addGlobalOptions(yargs);

  yargs
    .command(auth)
    .command(list)
    .command(rename)
    .command(use)
    .command(info)
    .command(remove)
    .command(clean)
    .command(createOverride)
    .command(removeOverride)
    .demandCommand(1, '');

  return yargs;
}

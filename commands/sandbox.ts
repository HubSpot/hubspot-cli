import { Argv } from 'yargs';
import { addGlobalOptions } from '../lib/commonOpts';
import { i18n } from '../lib/lang';
import { uiBetaTag } from '../lib/ui';
import * as create from './sandbox/create';
import * as del from './sandbox/delete';

export const command = ['sandbox', 'sandboxes'];
export const describe = uiBetaTag(i18n(`commands.sandbox.describe`), false);

export function builder(yargs: Argv): Argv {
  addGlobalOptions(yargs);

  yargs.command(create).command(del).demandCommand(1, '');

  return yargs;
}

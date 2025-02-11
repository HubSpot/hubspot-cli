import { Argv } from 'yargs';
import { addGlobalOptions } from '../lib/commonOpts';
import { i18n } from '../lib/lang';
import { uiBetaTag } from '../lib/ui';
import * as create from './sandbox/create';
import * as del from './sandbox/delete';

const i18nKey = 'commands.sandbox';

export const command = ['sandbox', 'sandboxes'];
export const describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

export function builder(yargs: Argv): Argv {
  addGlobalOptions(yargs);

  // @ts-ignore TODO
  yargs.command(create).command(del).demandCommand(1, '');

  return yargs;
}

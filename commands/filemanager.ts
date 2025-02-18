import { Argv } from 'yargs';

import * as upload from './filemanager/upload';
import * as fetch from './filemanager/fetch';
import { i18n } from '../lib/lang';

const i18nKey = 'commands.filemanager';

export const command = 'filemanager';
export const describe = i18n(`${i18nKey}.describe`);

export function builder(yargs: Argv): Argv {
  yargs.command(upload).command(fetch).demandCommand(1, '');

  return yargs;
}

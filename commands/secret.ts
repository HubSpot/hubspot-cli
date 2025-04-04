import { Argv } from 'yargs';
import { addGlobalOptions } from '../lib/commonOpts';
import * as addSecretCommand from './secret/addSecret';
import * as listSecretCommand from './secret/listSecret';
import * as deleteSecretCommand from './secret/deleteSecret';
import * as updateSecretCommand from './secret/updateSecret';
import { i18n } from '../lib/lang';

export const command = ['secret', 'secrets'];
export const describe = i18n(`commands.secret.describe`);

export function builder(yargs: Argv): Argv {
  addGlobalOptions(yargs);

  yargs
    .command(listSecretCommand)
    .command(addSecretCommand)
    .command(updateSecretCommand)
    .command(deleteSecretCommand)
    .demandCommand(1, '');
  return yargs;
}

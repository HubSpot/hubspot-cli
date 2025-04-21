import { Argv } from 'yargs';
import { i18n } from '../../lib/lang';
import { YargsCommandModuleBucket } from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';
import addAppSecretCommand from './secret/add';
import deleteAppSecretCommand from './secret/delete';

const i18nKey = 'commands.app.subcommands.secret';

export const command = ['secret', 'secrets'];
export const describe = i18n(`${i18nKey}.describe`);

export function appSecretBuilder(yargs: Argv): Argv {
  yargs
    .command(addAppSecretCommand)
    .command(deleteAppSecretCommand)
    .demandCommand(1, '');

  return yargs;
}

const builder = makeYargsBuilder(appSecretBuilder, command, describe);

const appSecretCommand: YargsCommandModuleBucket<unknown, Argv> = {
  command,
  describe,
  builder,
};

export default appSecretCommand;

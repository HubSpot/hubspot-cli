import { Argv } from 'yargs';
import { commands } from '../../lang/en';
import { YargsCommandModuleBucket } from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';
import addAppSecretCommand from './secret/add';
import deleteAppSecretCommand from './secret/delete';
import listAppSecretsCommand from './secret/list';
import updateAppSecretCommand from './secret/update';

const command = ['secret', 'secrets'];
const describe = commands.app.subcommands.secret.describe;

function appSecretBuilder(yargs: Argv): Argv {
  yargs
    .command(addAppSecretCommand)
    .command(deleteAppSecretCommand)
    .command(listAppSecretsCommand)
    .command(updateAppSecretCommand)
    .demandCommand(1, '');

  return yargs;
}

const builder = makeYargsBuilder(appSecretBuilder, command, describe);

const appSecretCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default appSecretCommand;

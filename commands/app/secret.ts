import { Argv } from 'yargs';
import { commands } from '../../lang/en.js';
import { YargsCommandModuleBucket } from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import addAppSecretCommand from './secret/add.js';
import deleteAppSecretCommand from './secret/delete.js';
import listAppSecretsCommand from './secret/list.js';
import updateAppSecretCommand from './secret/update.js';
import { uiBetaTag } from '../../lib/ui/index.js';

const command = ['secret', 'secrets'];
const describe = uiBetaTag(commands.app.subcommands.secret.describe, false);

function appSecretBuilder(yargs: Argv): Argv {
  yargs
    .command(addAppSecretCommand)
    .command(deleteAppSecretCommand)
    .command(listAppSecretsCommand)
    .command(updateAppSecretCommand)
    .demandCommand(1, '');

  return yargs;
}

const builder = makeYargsBuilder(
  appSecretBuilder,
  command,
  commands.app.subcommands.secret.describe
);

const appSecretCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default appSecretCommand;

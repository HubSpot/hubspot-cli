import { Argv } from 'yargs';
import addSecretCommand from './secret/addSecret';
import listSecretCommand from './secret/listSecret';
import deleteSecretCommand from './secret/deleteSecret';
import updateSecretCommand from './secret/updateSecret';
import { i18n } from '../lib/lang';
import { YargsCommandModuleBucket } from '../types/Yargs';
import { makeYargsBuilder } from '../lib/yargsUtils';

const command = ['secret', 'secrets'];
const describe = i18n(`commands.secret.describe`);

function secretBuilder(yargs: Argv): Argv {
  yargs
    .command(listSecretCommand)
    .command(addSecretCommand)
    .command(updateSecretCommand)
    .command(deleteSecretCommand)
    .demandCommand(1, '');
  return yargs;
}

const builder = makeYargsBuilder(secretBuilder, command, describe);

const secretCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default secretCommand;

// TODO Remove this legacy export once we've migrated all commands to TS
module.exports = secretCommand;

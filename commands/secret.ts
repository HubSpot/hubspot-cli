import { Argv } from 'yargs';
import addSecretCommand from './secret/addSecret.js';
import listSecretCommand from './secret/listSecret.js';
import deleteSecretCommand from './secret/deleteSecret.js';
import updateSecretCommand from './secret/updateSecret.js';
import { commands } from '../lang/en.js';
import { YargsCommandModuleBucket } from '../types/Yargs.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';

const command = ['secret', 'secrets'];
const describe = commands.secret.describe;

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

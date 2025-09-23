import { Argv } from 'yargs';
import createCommand from './hubdb/create.js';
import fetchCommand from './hubdb/fetch.js';
import deleteCommand from './hubdb/delete.js';
import clearCommand from './hubdb/clear.js';
import listCommand from './hubdb/list.js';
import { commands } from '../lang/en.js';
import { YargsCommandModuleBucket } from '../types/Yargs.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';

export const command = 'hubdb';
export const describe = commands.hubdb.describe;

function hubdbBuilder(yargs: Argv): Argv {
  yargs
    .command(clearCommand)
    .command(createCommand)
    .command(fetchCommand)
    .command(deleteCommand)
    .command(listCommand)
    .demandCommand(1, '');

  return yargs;
}

const builder = makeYargsBuilder(hubdbBuilder, command, describe);

const hubdbCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default hubdbCommand;
